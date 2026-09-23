package com.teacat.server.resale.service;

import com.teacat.server.booking.exception.BookingErrorCode;
import com.teacat.server.booking.service.BookingService;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.resale.service.SeatDrawWriter.Step;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 취소표 당첨 좌석이 <b>당첨자 손에 남아 있는가</b>.
 *
 * <p>🔴 이 테스트가 없어서 운영에서 좌석이 샜다 (2026-09-23). 당첨 좌석은 평범한 선점과
 * 행 모양이 똑같아서(status=HELD · held_by · held_until) 예매 쪽의 일반 선점 경로가 그것을
 * 자기 것인 줄 알고 풀어 버렸다 — <b>당첨자가 예매 화면에 들어간 것만으로</b> 프론트가
 * "쥔 것 먼저 놓기" 를 호출해 좌석이 AVAILABLE 이 됐고, 매진이 풀려 아무나 예약했다.
 * 한 번 풀리면 재추첨도 못 연다(좌석을 되찾아야 여는데 이미 남의 것이라서).
 *
 * <p>체인은 붙이지 않는다. 난수 확정은 {@link SeatDrawWriter#applyRevealed} 를 직접 불러
 * 흉내 낸다 — 여기서 보려는 것은 <b>난수 이후의 좌석 상태</b>이지 난수 자체가 아니다.
 */
class ResaleWinnerSeatIntegrationTests extends PostgresIntegrationTest {

    @Autowired
    private SeatDrawWriter drawWriter;

    @Autowired
    private BookingService bookingService;

    @Test
    void 당첨자에게_넘긴_좌석은_HELD_이고_held_by_가_당첨자다() {
        Scene scene = openDrawAndReveal();

        assertThat(drawWriter.step(scene.drawId())).isEqualTo(Step.GRANTED);

        Map<String, Object> seat = seat(scene);
        assertThat(seat.get("status")).isEqualTo("HELD");
        assertThat(seat.get("held_by")).isEqualTo(scene.winnerId());
        // 결제 기한(기본 12시간)이 그대로 선점 만료 시각이 된다.
        // JDBC 는 timestamp 를 java.sql.Timestamp 로 준다 — LocalDateTime 으로 바로 캐스팅되지 않는다
        LocalDateTime heldUntil = ((Timestamp) seat.get("held_until")).toLocalDateTime();
        assertThat(heldUntil)
                .isAfter(LocalDateTime.now().plusHours(11))
                .isBefore(LocalDateTime.now().plusHours(13));
    }

    @Test
    void 당첨_좌석은_일반_선점_해제로_풀리지_않는다() {
        Scene scene = openDrawAndReveal();
        drawWriter.step(scene.drawId());

        // 🔴 운영에서 터진 바로 그 호출. 프론트가 새 좌석을 잡기 전에 이것을 부른다
        assertThatThrownBy(() -> bookingService.releaseSeat(
                scene.performanceDetailId(), scene.seatId(), scene.winnerId()))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", BookingErrorCode.SEAT_HELD_BY_RESALE_DRAW);

        Map<String, Object> seat = seat(scene);
        assertThat(seat.get("status")).isEqualTo("HELD");
        assertThat(seat.get("held_by")).isEqualTo(scene.winnerId());
    }

    @Test
    void 결제_기한이_지나도_내_선점_조회가_당첨_좌석을_풀지_않는다() {
        Scene scene = openDrawAndReveal();
        drawWriter.step(scene.drawId());
        expireHold(scene);

        /* getMyHolds 는 만료된 선점을 먼저 정리한다. 당첨 좌석까지 정리해 버리면 좌석이
           일반 판매로 나가고, 그 뒤에는 추첨이 되찾지 못해 대기자들이 자리를 잃는다 */
        bookingService.getMyHolds(scene.winnerId());

        assertThat(seat(scene).get("status")).isEqualTo("HELD");
        assertThat(seat(scene).get("held_by")).isEqualTo(scene.winnerId());
    }

    @Test
    void 결제_기한이_지나도_남이_그_좌석을_잡지_못한다() {
        Scene scene = openDrawAndReveal();
        drawWriter.step(scene.drawId());
        expireHold(scene);

        // 선점 쿼리는 만료된 HELD 를 흡수한다. 당첨 좌석은 그 대상이 아니다
        assertThatThrownBy(() -> bookingService.holdSeat(
                scene.performanceDetailId(), scene.seatId(), scene.strangerId()))
                .isInstanceOf(BusinessException.class);

        assertThat(seat(scene).get("held_by")).isEqualTo(scene.winnerId());
    }

    @Test
    void 당첨을_포기하면_남은_대기자에게_다시_추첨한다() {
        Scene scene = openDrawAndReveal();
        drawWriter.step(scene.drawId());

        Optional<Long> nextDrawId = drawWriter.cancelOrForfeit(
                scene.winnerId(), scene.winnerEntryId(), false);

        assertThat(nextDrawId).isPresent();
        // 좌석은 추첨의 손으로 되돌아간다 — 일반 판매로 풀리지 않는다
        assertThat(seat(scene).get("status")).isEqualTo("SOLD");
        assertThat(seat(scene).get("held_by")).isNull();
        // 포기하지 않은 대기자는 그대로 대기다 (다음 추첨의 참가자)
        assertThat(entryStatus(scene.otherEntryId())).isEqualTo("WAITING");
        assertThat(entryStatus(scene.winnerEntryId())).isEqualTo("FORFEITED");
    }

    @Test
    void 대기자가_아무도_없으면_포기한_좌석은_일반_판매로_풀린다() {
        Scene scene = openDrawAndReveal();
        drawWriter.step(scene.drawId());
        // 남은 대기자가 스스로 대기를 접었다
        drawWriter.cancelOrForfeit(scene.otherId(), scene.otherEntryId(), false);

        Optional<Long> nextDrawId = drawWriter.cancelOrForfeit(
                scene.winnerId(), scene.winnerEntryId(), false);

        assertThat(nextDrawId).isEmpty();
        assertThat(seat(scene).get("status")).isEqualTo("AVAILABLE");
        assertThat(seat(scene).get("held_by")).isNull();
    }

    /* ── 장면 만들기 ───────────────────────────────────────────── */

    /**
     * 취소표 한 장 · 대기자 둘. 난수까지 확정된 상태를 만든다.
     *
     * <p>순위는 대기 신청 id 순서(당첨자 → 다른 대기자)로 박는다 — 실제로는 체인 난수가
     * 정하지만, 좌석 상태를 보는 테스트라 순서를 고정하는 편이 읽기 쉽다.
     */
    private Scene openDrawAndReveal() {
        Fixture fixture = insertPerformanceFixture();
        Long seatId = insertSeat(fixture);
        // 취소된 좌석은 추첨이 도는 동안 SOLD 로 남는다 (아무도 잡지 못한다)
        jdbcTemplate.update("""
                INSERT INTO performance_seats (performance_detail_id, seat_id, status)
                VALUES (?, ?, 'SOLD'::seat_booking_status)
                """, fixture.performanceDetailId(), seatId);

        Long winnerId = insertUserWithFace("resale-winner@test.com", "당첨자");
        Long otherId = insertUserWithFace("resale-other@test.com", "남은 대기자");
        Long strangerId = insertUserWithFace("resale-stranger@test.com", "지나가던 사람");

        Long winnerEntryId = insertWaitingEntry(fixture, winnerId);
        Long otherEntryId = insertWaitingEntry(fixture, otherId);

        Long drawId = drawWriter.claimSeatForDraw(fixture.performanceId(), fixture.performanceDetailId(),
                fixture.areaId(), seatId, null).orElseThrow();
        drawWriter.applyOpened(drawId, "0x" + "1".repeat(64), "0x" + "2".repeat(64));
        drawWriter.applyRevealed(drawId, "0x" + "3".repeat(64), List.of(winnerEntryId, otherEntryId));

        return new Scene(drawId, fixture.performanceDetailId(), seatId,
                winnerId, winnerEntryId, otherId, otherEntryId, strangerId);
    }

    private Long insertSeat(Fixture fixture) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO seats (area_id, row_label, seat_number) VALUES (?, 'A', 1) RETURNING id
                """, Long.class, fixture.areaId());
    }

    private Long insertWaitingEntry(Fixture fixture, Long userId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO resale_entries (user_id, performance_detail_id, area_id, status)
                VALUES (?, ?, ?, 'WAITING'::resale_entry_status) RETURNING id
                """, Long.class, userId, fixture.performanceDetailId(), fixture.areaId());
    }

    private Long insertUserWithFace(String email, String nickname) {
        Long userId = insertUser(email, nickname);
        jdbcTemplate.update("UPDATE users SET face_id = ? WHERE id = ?", insertFace(), userId);
        return userId;
    }

    /** 결제 기한을 지난 것으로 만든다. 시계를 돌리지 않고 행을 고친다 */
    private void expireHold(Scene scene) {
        jdbcTemplate.update("""
                UPDATE performance_seats SET held_until = now() - interval '1 minute'
                 WHERE performance_detail_id = ? AND seat_id = ?
                """, scene.performanceDetailId(), scene.seatId());
    }

    private Map<String, Object> seat(Scene scene) {
        return jdbcTemplate.queryForMap("""
                SELECT status::text AS status, held_by, held_until
                  FROM performance_seats
                 WHERE performance_detail_id = ? AND seat_id = ?
                """, scene.performanceDetailId(), scene.seatId());
    }

    private String entryStatus(Long entryId) {
        return jdbcTemplate.queryForObject(
                "SELECT status::text FROM resale_entries WHERE id = ?", String.class, entryId);
    }

    private record Scene(Long drawId, Long performanceDetailId, Long seatId,
                         Long winnerId, Long winnerEntryId,
                         Long otherId, Long otherEntryId, Long strangerId) {
    }
}
