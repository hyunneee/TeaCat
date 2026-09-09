package com.teacat.server.performance.service;

import com.teacat.server.common.config.PerformanceImageProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.performance.dto.request.ConcertUpdateRequest;
import com.teacat.server.performance.dto.request.PresignedUploadRequest;
import com.teacat.server.performance.dto.response.PresignedUploadResponse;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import com.teacat.server.stadium.repository.AreaRepository;
import com.teacat.server.ticket.repository.TicketRepository;
import com.teacat.server.stadium.repository.StadiumRepository;
import com.teacat.server.stadium.repository.StadiumLayoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.util.unit.DataSize;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 업로드 URL 방식으로 올린 이미지의 용량 한도 (API-262, API-270).
 *
 * 파일이 서버를 거치지 않으므로 key 를 넘겨받는 시점에 실제 크기를 확인해야 한다.
 */
@ExtendWith(MockitoExtension.class)
class AdminPerformanceServiceImageLimitTests {

    private static final String POSTER_KEY = "performance/poster/2026/09/a.png";
    private static final String DETAIL_KEY = "performance/detail/2026/09/b.png";
    private static final Long OWNER = 6L;

    @Mock private PerformanceGeneralRepository performanceGeneralRepository;
    @Mock private PerformanceDetailRepository performanceDetailRepository;
    @Mock private PerformanceAreaRepository performanceAreaRepository;
    @Mock private AreaRepository areaRepository;
    @Mock private TicketRepository ticketRepository;
    @Mock private StadiumRepository stadiumRepository;
    @Mock private StadiumLayoutRepository stadiumLayoutRepository;
    @Mock private FileStorageService fileStorageService;

    private AdminPerformanceService service;
    private PerformanceGeneral performance;

    @BeforeEach
    void setUp() {
        service = new AdminPerformanceService(
                performanceGeneralRepository, performanceDetailRepository, performanceAreaRepository,
                areaRepository, ticketRepository, stadiumRepository, stadiumLayoutRepository, fileStorageService,
                new PerformanceImageProperties(DataSize.ofMegabytes(5), DataSize.ofMegabytes(20)));

        // 티켓팅 시작 전 공연. 이미지 교체는 티켓팅과 무관하지만 다른 검사에 걸리지 않게 해둔다
        performance = PerformanceGeneral.create(
                null, "테스트 공연", LocalDateTime.now().plusDays(30), LocalDate.now(), null, null, OWNER);
    }

    private void givenPerformanceExists() {
        given(performanceGeneralRepository.findById(1L)).willReturn(Optional.of(performance));
    }

    @Test
    void 포스터가_5MB를_넘으면_파일을_지우고_거절한다() {
        givenPerformanceExists();
        given(fileStorageService.objectSize(POSTER_KEY))
                .willReturn(OptionalLong.of(DataSize.ofMegabytes(5).toBytes() + 1));

        assertThatThrownBy(() -> service.update(1L, requestWith(POSTER_KEY, null), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.IMAGE_TOO_LARGE);

        verify(fileStorageService).delete(POSTER_KEY);
        assertThat(performance.getPosterImageKey()).isNull();
    }

    @Test
    void 상세_이미지는_20MB까지_받는다() {
        givenPerformanceExists();
        given(fileStorageService.objectSize(DETAIL_KEY))
                .willReturn(OptionalLong.of(DataSize.ofMegabytes(20).toBytes()));

        service.update(1L, requestWith(null, DETAIL_KEY), OWNER);

        assertThat(performance.getDetailImageKey()).isEqualTo(DETAIL_KEY);
        verify(fileStorageService, never()).delete(anyString());
    }

    @Test
    void 같은_10MB_파일이라도_포스터로는_거절한다() {
        givenPerformanceExists();
        long tenMb = DataSize.ofMegabytes(10).toBytes();
        given(fileStorageService.objectSize(POSTER_KEY)).willReturn(OptionalLong.of(tenMb));

        assertThatThrownBy(() -> service.update(1L, requestWith(POSTER_KEY, null), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.IMAGE_TOO_LARGE);
    }

    @Test
    void 올리지_않은_key는_거절한다() {
        givenPerformanceExists();
        given(fileStorageService.objectSize(POSTER_KEY)).willReturn(OptionalLong.empty());

        assertThatThrownBy(() -> service.update(1L, requestWith(POSTER_KEY, null), OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.IMAGE_NOT_UPLOADED);

        verify(fileStorageService, never()).delete(anyString());
    }

    @Test
    void 업로드_URL_발급_응답에_용도별_한도를_함께_내려준다() {
        given(fileStorageService.presignedUploadUrl(anyString(), anyString()))
                .willReturn(new FileStorageService.PresignedUpload("k", "http://u", 600));

        PresignedUploadResponse poster = service.issueUploadUrl(
                new PresignedUploadRequest(PresignedUploadRequest.ImageType.POSTER, "image/png"));
        PresignedUploadResponse detail = service.issueUploadUrl(
                new PresignedUploadRequest(PresignedUploadRequest.ImageType.DETAIL, "image/png"));

        assertThat(poster.maxFileSizeBytes()).isEqualTo(DataSize.ofMegabytes(5).toBytes());
        assertThat(detail.maxFileSizeBytes()).isEqualTo(DataSize.ofMegabytes(20).toBytes());
    }

    private static ConcertUpdateRequest requestWith(String posterKey, String detailKey) {
        return new ConcertUpdateRequest(null, null, null, null, posterKey, detailKey);
    }
}
