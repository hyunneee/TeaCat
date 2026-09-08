package com.teacat.server.performance.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.performance.repository.PerformanceAreaRepository;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.stadium.repository.SeatRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 회차 삭제 (API-267) — 삭제 뒤 번호 재부여와 등록자 확인.
 */
@ExtendWith(MockitoExtension.class)
class AdminScheduleServiceTests {

    private static final Long OWNER = 6L;
    private static final Long OTHER_ADMIN = 7L;

    @Mock private PerformanceDetailRepository performanceDetailRepository;
    @Mock private PerformanceAreaRepository performanceAreaRepository;
    @Mock private PerformanceSeatRepository performanceSeatRepository;
    @Mock private SeatRepository seatRepository;

    @InjectMocks
    private AdminScheduleService service;

    private PerformanceDetail detail;

    @BeforeEach
    void setUp() {
        PerformanceGeneral performance = PerformanceGeneral.create(
                null, "테스트 공연", LocalDateTime.of(2026, 10, 1, 20, 0),
                LocalDate.of(2026, 9, 1), null, null, OWNER);
        detail = PerformanceDetail.create(performance, 2, LocalDateTime.of(2026, 11, 15, 19, 0));
        given(performanceDetailRepository.findWithPerformanceById(10L)).willReturn(Optional.of(detail));
    }

    @Test
    void 삭제_뒤에_남은_회차_번호를_일시_순으로_다시_매긴다() {
        given(performanceDetailRepository.existsTicketByScheduleId(10L)).willReturn(false);

        service.delete(10L, OWNER);

        // 음수로 비켜둔 뒤 재부여 — 순서가 바뀌면 UNIQUE 에 걸린다
        InOrder order = inOrder(performanceDetailRepository);
        order.verify(performanceDetailRepository).delete(detail);
        order.verify(performanceDetailRepository).negatePerformanceNums(any());
        order.verify(performanceDetailRepository).renumberByDate(any());
    }

    @Test
    void 예매_이력이_있는_회차는_지우지_않고_번호도_건드리지_않는다() {
        given(performanceDetailRepository.existsTicketByScheduleId(10L)).willReturn(true);

        assertThatThrownBy(() -> service.delete(10L, OWNER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.SCHEDULE_HAS_TICKETS);

        verify(performanceDetailRepository, never()).delete(any(PerformanceDetail.class));
        verify(performanceDetailRepository, never()).renumberByDate(any());
    }

    @Test
    void 다른_관리자의_공연_회차는_403() {
        assertThatThrownBy(() -> service.delete(10L, OTHER_ADMIN))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(PerformanceErrorCode.NOT_OWNER);

        verify(performanceDetailRepository, never()).delete(any(PerformanceDetail.class));
    }
}
