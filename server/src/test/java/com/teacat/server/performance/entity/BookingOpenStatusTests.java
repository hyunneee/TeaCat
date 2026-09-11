package com.teacat.server.performance.entity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class BookingOpenStatusTests {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 10, 12, 0);

    @Test
    void 예정_상태여도_오픈_시각이_지나면_예매할_수_있다() {
        assertThat(resolve(TicketingStatus.SCHEDULED, NOW.minusMinutes(1), NOW.plusHours(1)))
                .isEqualTo(BookingOpenStatus.OPEN);
    }

    @Test
    void 오픈_시각_전에는_예매할_수_없다() {
        assertThat(resolve(TicketingStatus.SCHEDULED, NOW.plusMinutes(1), NOW.plusHours(1)))
                .isEqualTo(BookingOpenStatus.BEFORE);
    }

    @ParameterizedTest
    @EnumSource(value = TicketingStatus.class, names = {"SOLD_OUT", "CLOSED"})
    void 판매_중단_상태는_오픈_시각이_지나도_예매할_수_없다(TicketingStatus status) {
        assertThat(resolve(status, NOW.minusHours(1), NOW.plusHours(1)))
                .isNotEqualTo(BookingOpenStatus.OPEN);
    }

    @Test
    void 공연이_시작되면_예매할_수_없다() {
        assertThat(resolve(TicketingStatus.SCHEDULED, NOW.minusHours(1), NOW))
                .isEqualTo(BookingOpenStatus.CLOSED);
    }

    private BookingOpenStatus resolve(TicketingStatus status,
                                      LocalDateTime ticketingStartAt,
                                      LocalDateTime performanceDate) {
        return BookingOpenStatus.resolve(status, ticketingStartAt, performanceDate, NOW);
    }
}
