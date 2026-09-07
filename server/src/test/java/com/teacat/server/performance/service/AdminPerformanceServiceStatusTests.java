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
 * 공연 상태 전환 (API-264).
 */
@ExtendWith(MockitoExtension.class)
class AdminPerformanceServiceStatusTests {

    @Mock
    private PerformanceGeneralRepository performanceGeneralRepository;

    @InjectMocks
    private AdminPerformanceService service;

    private PerformanceGeneral performance;

    @BeforeEach
    void setUp() {
        performance = PerformanceGeneral.create(
                null, "테스트 공연", LocalDateTime.of(2026, 10, 1, 20, 0),
                LocalDate.of(2026, 9, 1), null, null);
    }

    private void givenPerformanceExists() {
        given(performanceGeneralRepository.findById(1L)).willReturn(Optional.of(performance));
    }

    @Test
    void 예정에서_진행중으로_바꾸고_이전_상태를_함께_돌려준다() {
        givenPerformanceExists();

        ConcertStatusResponse response = service.changeStatus(1L, PerformanceStatus.ONGOING);

        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.ONGOING);
        assertThat(response.previousStatus()).isEqualTo(PerformanceStatus.UPCOMING);
        assertThat(response.status()).isEqualTo(PerformanceStatus.ONGOING);
    }

    @Test
    void 허용되지_않는_전이는_거절하고_상태를_바꾸지_않는다() {
        givenPerformanceExists();

        assertThatThrownBy(() -> service.changeStatus(1L, PerformanceStatus.ENDED))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.INVALID_STATUS_TRANSITION);

        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.UPCOMING);
    }

    @Test
    void 종료된_공연은_되돌릴_수_없다() {
        givenPerformanceExists();

        service.changeStatus(1L, PerformanceStatus.ONGOING);
        service.changeStatus(1L, PerformanceStatus.ENDED);

        assertThatThrownBy(() -> service.changeStatus(1L, PerformanceStatus.ONGOING))
                .isInstanceOf(BusinessException.class);
        assertThat(performance.getStatus()).isEqualTo(PerformanceStatus.ENDED);
    }

    @Test
    void 없는_공연이면_404_에러코드() {
        given(performanceGeneralRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeStatus(99L, PerformanceStatus.ONGOING))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.PERFORMANCE_NOT_FOUND);
    }
}
