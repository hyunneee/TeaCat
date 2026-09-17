package com.teacat.server.performance.entity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.LocalDateTime;
import java.util.List;

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

    /**
     * 🔴 <b>오픈 전이면 매진보다 "아직 안 열림" 이 먼저다.</b>
     *
     * <p>{@code performance_details.status} 의 SOLD_OUT 은 운영자가 손으로 바꾸는 값이고
     * 자동으로 돌아오지 않는다. 그래서 한 번 켜 두면 <b>티켓팅이 열리지도 않은 회차가
     * 계속 "매진" 으로 보였다</b> (QA). 홈 레일에서는 그 공연이 예매중 칸으로 올라와
     * 진짜 예매중인 공연을 밀어내기까지 했다.
     */
    @Test
    void 오픈_전이면_매진으로_표시돼_있어도_오픈_예정이다() {
        assertThat(resolve(TicketingStatus.SOLD_OUT, NOW.plusDays(3), NOW.plusDays(10)))
                .isEqualTo(BookingOpenStatus.BEFORE);
    }

    /** 열린 뒤에는 운영자가 켜 둔 매진이 그대로 먹는다 — 위 규칙이 매진을 없앤 것이 아니다 */
    @Test
    void 오픈_뒤에는_매진_표시가_그대로_먹는다() {
        assertThat(resolve(TicketingStatus.SOLD_OUT, NOW.minusHours(1), NOW.plusHours(1)))
                .isEqualTo(BookingOpenStatus.SOLDOUT);
    }

    /** 공연 목록 칩은 회차를 합친 값이다. 오픈 전 회차뿐이면 공연도 "오픈 예정" 이어야 한다 */
    @Test
    void 오픈_전_회차만_있으면_공연_칩도_오픈_예정이다() {
        BookingOpenStatus schedule =
                resolve(TicketingStatus.SOLD_OUT, NOW.plusDays(3), NOW.plusDays(10));

        assertThat(BookingOpenStatus.aggregate(List.of(schedule), NOW.plusDays(3), NOW))
                .isEqualTo(BookingOpenStatus.BEFORE);
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
