package com.teacat.server.booking.service;

import com.teacat.server.booking.dto.response.SeatHoldResponse;
import com.teacat.server.booking.entity.PerformanceSeatId;
import com.teacat.server.booking.entity.SeatBookingStatus;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.booking.repository.PerformanceSeatRepository.StandingSeatAllocation;
import com.teacat.server.booking.repository.PerformanceSeatRepository.TicketingWindow;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class BookingServiceTests {

    private static final Long SCHEDULE_ID = 8L;
    private static final Long SEAT_ID = 10L;
    private static final Long USER_ID = 3L;
    private static final Long AREA_ID = 20L;

    @Mock private PerformanceSeatRepository performanceSeatRepository;
    @Mock private UserRepository userRepository;
    /* 선점 목록의 포스터 키를 조회 URL 로 바꿀 때만 쓴다. 여기 테스트는 선점만 보므로
       호출되지 않아, 불필요한 스텁으로 잡히지 않게 lenient 로 둔다 */
    @Mock(strictness = Mock.Strictness.LENIENT) private FileStorageService fileStorageService;
    @Mock private TicketingWindow ticketingWindow;
    @Mock private StandingSeatAllocation standingSeatAllocation;

    private BookingService bookingService;

    @BeforeEach
    void setUp() {
        bookingService = new BookingService(
                performanceSeatRepository,
                userRepository,
                fileStorageService,
                Duration.ofMinutes(5));
    }

    @Test
    void 예정_상태여도_오픈_시각이_지났으면_좌석을_선점한다() {
        LocalDateTime now = LocalDateTime.now();
        PerformanceSeatId seatKey = new PerformanceSeatId(SCHEDULE_ID, SEAT_ID);

        given(userRepository.existsByIdAndFaceIsNotNull(USER_ID)).willReturn(true);
        given(performanceSeatRepository.findTicketingWindow(SCHEDULE_ID))
                .willReturn(Optional.of(ticketingWindow));
        given(ticketingWindow.getTicketingStatus()).willReturn("SCHEDULED");
        given(ticketingWindow.getTicketingStartAt()).willReturn(now.minusHours(1));
        given(ticketingWindow.getPerformanceDate()).willReturn(now.plusHours(1));
        given(performanceSeatRepository.existsById(seatKey)).willReturn(true);
        given(performanceSeatRepository.hold(
                org.mockito.ArgumentMatchers.eq(SCHEDULE_ID),
                org.mockito.ArgumentMatchers.eq(SEAT_ID),
                org.mockito.ArgumentMatchers.eq(USER_ID),
                any(LocalDateTime.class)))
                .willReturn(1);

        SeatHoldResponse response = bookingService.holdSeat(SCHEDULE_ID, SEAT_ID, USER_ID);

        assertThat(response.status()).isEqualTo(SeatBookingStatus.HELD);
        assertThat(response.performanceDetailId()).isEqualTo(SCHEDULE_ID);
        assertThat(response.seatId()).isEqualTo(SEAT_ID);
    }

    @Test
    void 스탠딩_구역은_서버가_가상_좌석을_자동_배정한다() {
        LocalDateTime now = LocalDateTime.now();
        givenOpenTicketingWindow(now);
        given(performanceSeatRepository.existsSellableStandingArea(SCHEDULE_ID, AREA_ID))
                .willReturn(true);
        given(performanceSeatRepository.holdAvailableStandingSeat(
                org.mockito.ArgumentMatchers.eq(SCHEDULE_ID),
                org.mockito.ArgumentMatchers.eq(AREA_ID),
                org.mockito.ArgumentMatchers.eq(USER_ID),
                any(LocalDateTime.class)))
                .willReturn(Optional.of(standingSeatAllocation));
        given(standingSeatAllocation.getSeatId()).willReturn(SEAT_ID);
        given(standingSeatAllocation.getHeldUntil()).willReturn(now.plusMinutes(5));
        given(standingSeatAllocation.getRemainingSeconds()).willReturn(300L);

        SeatHoldResponse response = bookingService.holdStandingSeat(SCHEDULE_ID, AREA_ID, USER_ID);

        assertThat(response.status()).isEqualTo(SeatBookingStatus.HELD);
        assertThat(response.performanceDetailId()).isEqualTo(SCHEDULE_ID);
        assertThat(response.seatId()).isEqualTo(SEAT_ID);
        assertThat(response.remainingSeconds()).isEqualTo(300L);
    }

    @Test
    void 스탠딩_구역에_남은_가상_좌석이_없으면_매진으로_거절한다() {
        LocalDateTime now = LocalDateTime.now();
        givenOpenTicketingWindow(now);
        given(performanceSeatRepository.existsSellableStandingArea(SCHEDULE_ID, AREA_ID))
                .willReturn(true);
        given(performanceSeatRepository.holdAvailableStandingSeat(
                org.mockito.ArgumentMatchers.eq(SCHEDULE_ID),
                org.mockito.ArgumentMatchers.eq(AREA_ID),
                org.mockito.ArgumentMatchers.eq(USER_ID),
                any(LocalDateTime.class)))
                .willReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> bookingService.holdStandingSeat(SCHEDULE_ID, AREA_ID, USER_ID))
                .isInstanceOf(BusinessException.class)
                .hasMessage("선택한 스탠딩 구역의 입장권이 매진되었습니다.");
    }

    private void givenOpenTicketingWindow(LocalDateTime now) {
        given(userRepository.existsByIdAndFaceIsNotNull(USER_ID)).willReturn(true);
        given(performanceSeatRepository.findTicketingWindow(SCHEDULE_ID))
                .willReturn(Optional.of(ticketingWindow));
        given(ticketingWindow.getTicketingStatus()).willReturn("SCHEDULED");
        given(ticketingWindow.getTicketingStartAt()).willReturn(now.minusHours(1));
        given(ticketingWindow.getPerformanceDate()).willReturn(now.plusHours(1));
    }
}
