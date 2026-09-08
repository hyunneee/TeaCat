package com.teacat.server.performance.service;

import com.teacat.server.common.config.PerformanceImageProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.performance.dto.request.ConcertCreateRequest;
import com.teacat.server.performance.dto.response.ConcertCreateResponse;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.entity.StadiumLayout;
import com.teacat.server.stadium.repository.AreaRepository;
import com.teacat.server.stadium.repository.StadiumRepository;
import com.teacat.server.stadium.repository.StadiumLayoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.util.unit.DataSize;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 공연 등록 (API-261) — 회차를 함께 만드는 규칙.
 */
@ExtendWith(MockitoExtension.class)
class AdminPerformanceServiceCreateTests {

    private static final Long ADMIN = 6L;
    private static final LocalDateTime TICKETING = LocalDateTime.of(2026, 10, 1, 20, 0);

    @Mock private PerformanceGeneralRepository performanceGeneralRepository;
    @Mock private PerformanceDetailRepository performanceDetailRepository;
    @Mock private PerformanceAreaRepository performanceAreaRepository;
    @Mock private AreaRepository areaRepository;
    @Mock private StadiumRepository stadiumRepository;
    @Mock private StadiumLayoutRepository stadiumLayoutRepository;
    @Mock private FileStorageService fileStorageService;

    private AdminPerformanceService service;

    @BeforeEach
    void setUp() {
        service = new AdminPerformanceService(
                performanceGeneralRepository, performanceDetailRepository, performanceAreaRepository,
                areaRepository, stadiumRepository, stadiumLayoutRepository, fileStorageService,
                new PerformanceImageProperties(DataSize.ofMegabytes(5), DataSize.ofMegabytes(20)));
    }

    private void givenStadiumAndSave() {
        Stadium stadium = mock(Stadium.class);
        given(stadium.getId()).willReturn(1L);
        given(stadiumRepository.findById(1L)).willReturn(Optional.of(stadium));
        given(stadiumLayoutRepository.findDefaultByStadiumId(1L))
                .willReturn(Optional.of(mock(StadiumLayout.class)));
        given(performanceGeneralRepository.save(any(PerformanceGeneral.class)))
                .willAnswer(invocation -> invocation.getArgument(0));
        given(performanceDetailRepository.saveAll(anyList()))
                .willAnswer(invocation -> invocation.getArgument(0));
    }

    private static ConcertCreateRequest requestWith(List<LocalDateTime> dates) {
        return new ConcertCreateRequest(
                1L, "테스트 공연", TICKETING, LocalDate.of(2026, 9, 1), null, null, dates);
    }

    @Test
    @SuppressWarnings("unchecked")
    void 회차는_일시_순으로_1회차부터_번호가_붙는다() {
        givenStadiumAndSave();
        LocalDateTime later = LocalDateTime.of(2026, 11, 15, 19, 0);
        LocalDateTime earlier = LocalDateTime.of(2026, 11, 14, 19, 0);

        ConcertCreateResponse response = service.create(requestWith(List.of(later, earlier)), ADMIN);

        ArgumentCaptor<List<PerformanceDetail>> captor = ArgumentCaptor.forClass(List.class);
        verify(performanceDetailRepository).saveAll(captor.capture());
        List<PerformanceDetail> saved = captor.getValue();

        assertThat(response.scheduleCount()).isEqualTo(2);
        assertThat(saved).extracting(PerformanceDetail::getPerformanceNum).containsExactly(1, 2);
        assertThat(saved).extracting(PerformanceDetail::getPerformanceDate).containsExactly(earlier, later);
    }

    @Test
    void 나중에_추가한_회차도_일시_순으로_번호를_다시_매긴다() {
        PerformanceGeneral performance = PerformanceGeneral.create(
                null, "테스트 공연", TICKETING, LocalDate.of(2026, 9, 1), null, null, ADMIN);
        given(performanceGeneralRepository.findById(1L)).willReturn(Optional.of(performance));
        given(performanceDetailRepository.findMaxPerformanceNum(1L)).willReturn(2);
        given(performanceDetailRepository.save(any(PerformanceDetail.class)))
                .willAnswer(invocation -> invocation.getArgument(0));
        // 재부여 뒤 DB 에서 다시 읽은 번호 — 가장 이른 날짜라 1회차가 된다
        given(performanceDetailRepository.findPerformanceNumById(any())).willReturn(1);

        var response = service.createSchedule(
                1L, new com.teacat.server.performance.dto.request.ScheduleCreateRequest(
                        LocalDateTime.of(2026, 11, 1, 19, 0), null), ADMIN);

        assertThat(response.performanceNum()).isEqualTo(1);
        var order = org.mockito.Mockito.inOrder(performanceDetailRepository);
        order.verify(performanceDetailRepository).save(any(PerformanceDetail.class));
        order.verify(performanceDetailRepository).negatePerformanceNums(1L);
        order.verify(performanceDetailRepository).renumberByDate(1L);
    }

    @Test
    void 번호를_직접_지정하면_다시_매기지_않는다() {
        PerformanceGeneral performance = PerformanceGeneral.create(
                null, "테스트 공연", TICKETING, LocalDate.of(2026, 9, 1), null, null, ADMIN);
        given(performanceGeneralRepository.findById(1L)).willReturn(Optional.of(performance));
        given(performanceDetailRepository.existsByPerformanceIdAndPerformanceNum(1L, 5)).willReturn(false);
        given(performanceDetailRepository.save(any(PerformanceDetail.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

        var response = service.createSchedule(
                1L, new com.teacat.server.performance.dto.request.ScheduleCreateRequest(
                        LocalDateTime.of(2026, 11, 1, 19, 0), 5), ADMIN);

        assertThat(response.performanceNum()).isEqualTo(5);
        verify(performanceDetailRepository, never()).renumberByDate(any());
    }

    @Test
    void 회차_없이도_등록된다() {
        givenStadiumAndSave();

        ConcertCreateResponse response = service.create(requestWith(null), ADMIN);

        assertThat(response.scheduleCount()).isZero();
    }

    @Test
    void 티켓팅_시작_전_일시의_회차는_거절하고_아무것도_저장하지_않는다() {
        given(stadiumRepository.findById(1L)).willReturn(Optional.of(mock(Stadium.class)));

        assertThatThrownBy(() -> service.create(requestWith(List.of(TICKETING.minusDays(1))), ADMIN))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.INVALID_PERFORMANCE_DATE);

        verify(performanceGeneralRepository, never()).save(any());
        verify(fileStorageService, never()).uploadImage(any(), any(), any());
    }

    @Test
    void 같은_일시가_두_번_오면_거절한다() {
        given(stadiumRepository.findById(1L)).willReturn(Optional.of(mock(Stadium.class)));
        LocalDateTime date = LocalDateTime.of(2026, 11, 14, 19, 0);

        assertThatThrownBy(() -> service.create(requestWith(List.of(date, date)), ADMIN))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.DUPLICATE_PERFORMANCE_DATE);

        verify(performanceGeneralRepository, never()).save(any());
    }
}
