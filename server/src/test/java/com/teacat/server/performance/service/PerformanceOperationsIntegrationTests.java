package com.teacat.server.performance.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.performance.dto.request.OperationsCheckInFilter;
import com.teacat.server.performance.dto.response.OperationsAttendeePageResponse;
import com.teacat.server.performance.dto.response.OperationsSeatMapResponse;
import com.teacat.server.performance.exception.PerformanceErrorCode;
import com.teacat.server.support.PostgresIntegrationTest;
import com.teacat.server.user.entity.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 운영 좌석·예매자 조회를 <b>실제 PostgreSQL 위에서</b> 검증한다.
 *
 * <p>단위 테스트(목)로는 잡히지 않는 것을 여기서 잡는다.
 * <ul>
 *   <li>선택 조건이 없을 때의 JPQL — {@code :areaId IS NULL} 같은 식이 실제 DB 에서 도는지</li>
 *   <li>커서 페이지가 실제 정렬에서 겹치거나 빠지지 않는지</li>
 *   <li>스탠딩 티켓(좌석 없음)이 집계에서 사라지지 않는지</li>
 * </ul>
 */
class PerformanceOperationsIntegrationTests extends PostgresIntegrationTest {

    private static final AuthUser ADMIN = new AuthUser(1L, UserRole.ADMIN);

    @Autowired
    private PerformanceOperationsService service;

    private Fixture fixture;
    private Long bookedTicketId;
    private Long enteredTicketId;
    private Long availableSeatId;

    @BeforeEach
    void setUpPerformance() {
        fixture = insertPerformanceFixture();

        Long booker = insertUser("booker@teacat.test", "예매한사람");
        Long enteredBooker = insertUser("entered@teacat.test", "입장한사람");
        jdbcTemplate.update("UPDATE users SET name = ?, phone = ? WHERE id = ?",
                "홍길동", "01012345678", booker);
        jdbcTemplate.update("UPDATE users SET name = ?, phone = ? WHERE id = ?",
                "김철수", "01099998888", enteredBooker);

        bookedTicketId = insertTicket(booker, fixture);
        enteredTicketId = insertTicket(enteredBooker, fixture);
        jdbcTemplate.update("UPDATE tickets SET checked_in_at = now() WHERE id = ?", enteredTicketId);

        // 아무도 예매하지 않은 빈자리 하나 — 좌석 상태만 있는 경우를 확인한다
        availableSeatId = jdbcTemplate.queryForObject("""
                INSERT INTO seats (area_id, row_label, seat_number) VALUES (?, '3', 99) RETURNING id
                """, Long.class, fixture.areaId());

        // 회차 좌석 행은 예매가 열릴 때 만들어진다. 여기서는 필요한 세 자리만 직접 넣는다
        insertPerformanceSeat(seatIdOf(bookedTicketId), "SOLD");
        insertPerformanceSeat(seatIdOf(enteredTicketId), "SOLD");
        insertPerformanceSeat(availableSeatId, "AVAILABLE");
    }

    @Test
    void 좌석맵은_예매와_입장을_구분해_보여준다() {
        OperationsSeatMapResponse response =
                service.getSeatMap(ADMIN, fixture.performanceId(), fixture.performanceDetailId());

        assertThat(response.summary().bookedCount()).isEqualTo(2);
        assertThat(response.summary().checkedInCount()).isEqualTo(1);
        assertThat(response.summary().notCheckedInCount()).isEqualTo(1);

        OperationsSeatMapResponse.Area area = response.areas().getFirst();
        assertThat(area.seats()).hasSize(3);
        assertThat(state(area, seatIdOf(bookedTicketId)))
                .isEqualTo(OperationsSeatMapResponse.SeatState.BOOKED);
        assertThat(state(area, seatIdOf(enteredTicketId)))
                .isEqualTo(OperationsSeatMapResponse.SeatState.CHECKED_IN);
        assertThat(state(area, availableSeatId))
                .isEqualTo(OperationsSeatMapResponse.SeatState.AVAILABLE);
    }

    @Test
    void 취소된_표는_예매_집계에서_빠지고_명단에는_남는다() {
        jdbcTemplate.update("UPDATE tickets SET status = 'CANCELLED' WHERE id = ?", bookedTicketId);

        OperationsSeatMapResponse seatMap =
                service.getSeatMap(ADMIN, fixture.performanceId(), fixture.performanceDetailId());
        assertThat(seatMap.summary().bookedCount()).isEqualTo(1);

        // 운영 문의는 대개 취소 건이라 명단에서 거르지 않는다 — 상태 칩이 알려준다
        OperationsAttendeePageResponse page = attendees(null, null, OperationsCheckInFilter.ALL, null);
        assertThat(page.items()).hasSize(2);
        assertThat(page.items()).anySatisfy(row ->
                assertThat(row.status().name()).isEqualTo("CANCELLED"));
    }

    @Test
    void 명단의_개인정보는_가려서_나간다() {
        OperationsAttendeePageResponse page = attendees(null, null, null, null);

        assertThat(page.totalCount()).isEqualTo(2);
        assertThat(page.items()).allSatisfy(row -> {
            assertThat(row.holderName()).doesNotContain("길", "철");
            assertThat(row.holderPhone()).contains("****");
        });
        assertThat(page.items()).anySatisfy(row -> {
            assertThat(row.holderName()).isEqualTo("홍*동");
            assertThat(row.holderPhone()).isEqualTo("010-****-5678");
        });
    }

    @Test
    void 입장_상태와_이름으로_거를_수_있다() {
        assertThat(attendees(null, null, OperationsCheckInFilter.CHECKED_IN, null).items())
                .singleElement()
                .satisfies(row -> assertThat(row.ticketId()).isEqualTo(enteredTicketId));

        assertThat(attendees(null, null, OperationsCheckInFilter.NOT_CHECKED_IN, null).items())
                .singleElement()
                .satisfies(row -> assertThat(row.ticketId()).isEqualTo(bookedTicketId));

        // 이름으로 찾기 (마스킹은 응답에만 걸리고 검색은 원본으로 한다)
        assertThat(attendees("홍길동", null, null, null).items())
                .singleElement()
                .satisfies(row -> assertThat(row.ticketId()).isEqualTo(bookedTicketId));

        // 티켓 번호로 찾기
        assertThat(attendees(String.valueOf(enteredTicketId), null, null, null).items())
                .singleElement()
                .satisfies(row -> assertThat(row.ticketId()).isEqualTo(enteredTicketId));

        // 다른 구역으로 거르면 아무도 남지 않는다
        assertThat(attendees(null, fixture.areaId() + 1000, null, null).items()).isEmpty();
    }

    @Test
    void 커서로_넘긴_다음_페이지가_겹치지_않는다() {
        OperationsAttendeePageResponse first = service.getAttendees(
                ADMIN, fixture.performanceId(), fixture.performanceDetailId(),
                null, null, null, null, 1);

        assertThat(first.items()).hasSize(1);
        assertThat(first.hasNext()).isTrue();

        OperationsAttendeePageResponse second = service.getAttendees(
                ADMIN, fixture.performanceId(), fixture.performanceDetailId(),
                null, null, null, first.nextCursor(), 1);

        assertThat(second.items()).hasSize(1);
        assertThat(second.items().getFirst().ticketId())
                .isNotEqualTo(first.items().getFirst().ticketId());
        assertThat(second.hasNext()).isFalse();
    }

    @Test
    void 좌석이_없는_스탠딩_티켓도_집계에_들어간다() {
        Long standingAreaId = jdbcTemplate.queryForObject("""
                INSERT INTO areas (stadium_id, stadium_layout_id, area_code, type, max_seat)
                VALUES ((SELECT stadium_id FROM performance_general WHERE id = ?),
                        (SELECT stadium_layout_id FROM performance_general WHERE id = ?),
                        'S', 'STANDING', 500) RETURNING id
                """, Long.class, fixture.performanceId(), fixture.performanceId());
        jdbcTemplate.update("""
                INSERT INTO performance_areas
                    (performance_general_id, area_id, grade, price, max_cnt, sale_type)
                VALUES (?, ?, '스탠딩', 66000, 300, 'STANDING')
                """, fixture.performanceId(), standingAreaId);

        Long standingUser = insertUser("standing@teacat.test", "서서보는사람");
        jdbcTemplate.update("""
                INSERT INTO tickets (user_id, performance_detail_id, area_id, seat_id, status)
                VALUES (?, ?, ?, NULL, 'CONFIRMED')
                """, standingUser, fixture.performanceDetailId(), standingAreaId);

        OperationsSeatMapResponse response =
                service.getSeatMap(ADMIN, fixture.performanceId(), fixture.performanceDetailId());

        assertThat(response.summary().bookedCount()).isEqualTo(3);
        OperationsSeatMapResponse.Area standing = response.areas().stream()
                .filter(area -> area.areaId().equals(standingAreaId))
                .findFirst()
                .orElseThrow();
        // 가상 좌석을 그리지 않고 정원만 알려준다
        assertThat(standing.seats()).isEmpty();
        assertThat(standing.capacity()).isEqualTo(300);
        assertThat(standing.bookedCount()).isEqualTo(1);
    }

    @Test
    void 다른_공연의_회차는_열지_못한다() {
        Fixture other = insertPerformanceFixture();

        assertThatThrownBy(() -> service.getSeatMap(
                ADMIN, fixture.performanceId(), other.performanceDetailId()))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getErrorCode())
                .isEqualTo(PerformanceErrorCode.SCHEDULE_NOT_FOUND);
    }

    /* ── 도우미 ─────────────────────────────────────────────── */

    private OperationsAttendeePageResponse attendees(String keyword, Long areaId,
                                                     OperationsCheckInFilter filter, String cursor) {
        return service.getAttendees(ADMIN, fixture.performanceId(), fixture.performanceDetailId(),
                keyword, areaId, filter, cursor, null);
    }

    private void insertPerformanceSeat(Long seatId, String status) {
        jdbcTemplate.update("""
                INSERT INTO performance_seats (performance_detail_id, seat_id, status)
                VALUES (?, ?, ?::seat_booking_status)
                """, fixture.performanceDetailId(), seatId, status);
    }

    private Long seatIdOf(Long ticketId) {
        return jdbcTemplate.queryForObject("SELECT seat_id FROM tickets WHERE id = ?", Long.class, ticketId);
    }

    private OperationsSeatMapResponse.SeatState state(OperationsSeatMapResponse.Area area, Long seatId) {
        return area.seats().stream()
                .filter(seat -> seat.seatId().equals(seatId))
                .findFirst()
                .orElseThrow()
                .state();
    }
}
