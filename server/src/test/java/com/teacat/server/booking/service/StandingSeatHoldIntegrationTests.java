package com.teacat.server.booking.service;

import com.teacat.server.booking.dto.response.SeatHoldResponse;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

class StandingSeatHoldIntegrationTests extends PostgresIntegrationTest {

    @Autowired
    private BookingService bookingService;

    @Test
    void 같은_사용자의_재요청은_기존_스탠딩_좌석을_그대로_반환한다() {
        StandingFixture fixture = insertStandingFixture(2);
        Long userId = insertUserWithFace("standing-repeat@test.com", "재요청 사용자");

        SeatHoldResponse first = bookingService.holdStandingSeat(
                fixture.performanceDetailId(), fixture.areaId(), userId);
        SeatHoldResponse repeated = bookingService.holdStandingSeat(
                fixture.performanceDetailId(), fixture.areaId(), userId);

        assertThat(repeated.seatId()).isEqualTo(first.seatId());
        assertThat(repeated.heldUntil()).isEqualTo(first.heldUntil());
        assertThat(countActiveHolds(fixture.performanceDetailId())).isEqualTo(1);
    }

    @Test
    void 서로_다른_사용자의_동시_요청에는_서로_다른_가상_좌석을_배정한다() throws Exception {
        StandingFixture fixture = insertStandingFixture(2);
        Long firstUserId = insertUserWithFace("standing-1@test.com", "첫 사용자");
        Long secondUserId = insertUserWithFace("standing-2@test.com", "둘째 사용자");
        CountDownLatch start = new CountDownLatch(1);

        CompletableFuture<SeatHoldResponse> first = CompletableFuture.supplyAsync(
                () -> holdAfterSignal(start, fixture, firstUserId));
        CompletableFuture<SeatHoldResponse> second = CompletableFuture.supplyAsync(
                () -> holdAfterSignal(start, fixture, secondUserId));
        start.countDown();

        SeatHoldResponse firstHold = first.get(10, TimeUnit.SECONDS);
        SeatHoldResponse secondHold = second.get(10, TimeUnit.SECONDS);

        assertThat(firstHold.seatId()).isNotEqualTo(secondHold.seatId());
        assertThat(countActiveHolds(fixture.performanceDetailId())).isEqualTo(2);
    }

    private SeatHoldResponse holdAfterSignal(
            CountDownLatch start, StandingFixture fixture, Long userId) {
        try {
            start.await(5, TimeUnit.SECONDS);
            return bookingService.holdStandingSeat(
                    fixture.performanceDetailId(), fixture.areaId(), userId);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private Long insertUserWithFace(String email, String nickname) {
        Long userId = insertUser(email, nickname);
        jdbcTemplate.update("UPDATE users SET face_id = ? WHERE id = ?", insertFace(), userId);
        return userId;
    }

    private StandingFixture insertStandingFixture(int capacity) {
        Fixture base = insertPerformanceFixture();
        jdbcTemplate.update("""
                UPDATE areas
                   SET type = 'STANDING'::area_type,
                       max_seat = ?
                 WHERE id = ?
                """, capacity, base.areaId());
        jdbcTemplate.update("""
                UPDATE performance_areas
                   SET sale_type = 'STANDING'::area_type,
                       max_cnt = ?
                 WHERE performance_general_id = ?
                   AND area_id = ?
                """, capacity, base.performanceId(), base.areaId());
        jdbcTemplate.update("""
                UPDATE performance_details
                   SET performance_date = now() + interval '1 day'
                 WHERE id = ?
                """, base.performanceDetailId());

        for (int number = 1; number <= capacity; number++) {
            Long seatId = jdbcTemplate.queryForObject("""
                    INSERT INTO seats (area_id, row_label, seat_number)
                    VALUES (?, 'STANDING', ?) RETURNING id
                    """, Long.class, base.areaId(), number);
            jdbcTemplate.update("""
                    INSERT INTO performance_seats (performance_detail_id, seat_id, status)
                    VALUES (?, ?, 'AVAILABLE'::seat_booking_status)
                    """, base.performanceDetailId(), seatId);
        }
        return new StandingFixture(base.performanceDetailId(), base.areaId());
    }

    private int countActiveHolds(Long performanceDetailId) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*)::int
                  FROM performance_seats
                 WHERE performance_detail_id = ?
                   AND status = 'HELD'::seat_booking_status
                """, Integer.class, performanceDetailId);
    }

    private record StandingFixture(Long performanceDetailId, Long areaId) {
    }
}
