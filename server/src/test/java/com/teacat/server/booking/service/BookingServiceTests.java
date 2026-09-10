package com.teacat.server.booking.service;

import com.teacat.server.booking.dto.response.SeatHoldResponse;
import com.teacat.server.booking.entity.PerformanceSeatId;
import com.teacat.server.booking.entity.SeatBookingStatus;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.booking.repository.PerformanceSeatRepository.TicketingWindow;
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

    @Mock private PerformanceSeatRepository performanceSeatRepository;
    @Mock private UserRepository userRepository;
    @Mock private TicketingWindow ticketingWindow;

    private BookingService bookingService;

    @BeforeEach
    void setUp() {
        bookingService = new BookingService(
                performanceSeatRepository,
                userRepository,
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
}
