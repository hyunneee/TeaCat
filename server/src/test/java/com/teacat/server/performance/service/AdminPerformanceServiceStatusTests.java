package com.teacat.server.performance.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.dto.response.ConcertStatusResponse;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.entity.PerformanceStatus;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceGeneralRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

/**
 * 공연 상태 전환 (API-264) 과 등록자 확인.
 */
@ExtendWith(MockitoExtension.class)
class AdminPerformanceServiceStatusTests {

    private static final Long OWNER = 6L;
    private static final Long OTHER_ADMIN = 7L;

    @Mock
    private PerformanceGeneralRepository performanceGeneralRepository;

    @InjectMocks
    private AdminPerformanceService service;

    private PerformanceGeneral performance;

    @BeforeEach
    void setUp() {
        performance = PerformanceGeneral.create(
                null, "테스트 공연", LocalDateTime.of(2026, 10, 1, 20, 0),
                LocalDate.of(2026, 9, 1), null, null, OWNER);
    }

    private void givenPerformanceExists() {
        given(performanceGeneralRepository.findById(1L)).willReturn(Optional.of(performance));
    }

    @Test
    void 예정에서_진행중으로_바꾸고_이전_상태를_함께_돌려준다() {
        givenPerformanceExists();

        ConcertStatusResponse response = service.changeStatus(1L, PerformanceStatus.ONGOING, OWNER);

        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.ONGOING);
        assertThat(response.previousStatus()).isEqualTo(PerformanceStatus.UPCOMING);
        assertThat(response.status()).isEqualTo(PerformanceStatus.ONGOING);
    }

    @Test
    void 허용되지_않는_전이는_거절하고_상태를_바꾸지_않는다() {
        givenPerformanceExists();

        assertThatThrownBy(() -> service.changeStatus(1L, PerformanceStatus.ENDED, OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.INVALID_STATUS_TRANSITION);

        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.UPCOMING);
    }

    @Test
    void 종료된_공연은_되돌릴_수_없다() {
        givenPerformanceExists();

        service.changeStatus(1L, PerformanceStatus.ONGOING, OWNER);
        service.changeStatus(1L, PerformanceStatus.ENDED, OWNER);

        assertThatThrownBy(() -> service.changeStatus(1L, PerformanceStatus.ONGOING, OWNER))
                .isInstanceOf(BusinessException.class);
        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.ENDED);
    }

    @Test
    void 없는_공연이면_404_에러코드() {
        given(performanceGeneralRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeStatus(99L, PerformanceStatus.ONGOING, OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.PERFORMANCE_NOT_FOUND);
    }

    @Test
    void 다른_관리자가_등록한_공연은_403으로_거절하고_상태를_바꾸지_않는다() {
        givenPerformanceExists();

        assertThatThrownBy(() -> service.changeStatus(1L, PerformanceStatus.ONGOING, OTHER_ADMIN))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.NOT_OWNER);

        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.UPCOMING);
    }

    @Test
    void 등록자를_알_수_없는_공연은_누구도_관리할_수_없다() {
        PerformanceGeneral legacy = PerformanceGeneral.create(
                null, "옛 공연", LocalDateTime.of(2026, 10, 1, 20, 0), LocalDate.of(2026, 9, 1), null, null, null);
        given(performanceGeneralRepository.findById(2L)).willReturn(Optional.of(legacy));

        assertThatThrownBy(() -> service.delete(2L, OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.NOT_OWNER);
    }
}
