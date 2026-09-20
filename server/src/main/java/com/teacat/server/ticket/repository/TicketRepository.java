package com.teacat.server.ticket.repository;

import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.ticket.entity.TicketStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    /**
     * 내 티켓 목록.
     *
     * <p>공연·공연장·구역·좌석을 함께 읽는다. 응답에 전부 필요한 값이라 지연 로딩으로 두면
     * 티켓 수만큼 쿼리가 늘어난다. 좌석은 스탠딩이면 없으므로 LEFT JOIN 이다.
     */
    @Query("""
            SELECT t FROM Ticket t
            JOIN FETCH t.performanceDetail pd
            JOIN FETCH pd.performance p
            JOIN FETCH p.stadium
            JOIN FETCH t.area
            LEFT JOIN FETCH t.seat
            WHERE t.user.id = :userId
            ORDER BY t.id DESC
            """)
    List<Ticket> findMyTickets(@Param("userId") Long userId, Limit limit);

    /**
     * 이 회원의 티켓에 베껴 둔 얼굴을 지운다 (탈퇴 시).
     *
     * <p>🔴 <b>탈퇴에서만 부른다.</b> 얼굴 삭제(API-110)는 티켓을 건드리지 않는다 — 예매 당시
     * 얼굴을 남기려고 복사해 둔 것이라, 프로필의 얼굴을 뺀다고 발권 기록까지 지울 이유가 없다.
     * 탈퇴는 다르다. 생체정보를 즉시 파기한다고 고지했으므로 복사본까지 없애야 한다
     * (server/CLAUDE.md 6장).
     *
     * <p>한 건씩 엔티티를 불러 고치지 않고 <b>한 문장으로</b> 지운다. 예매가 많은 회원이면
     * 티켓 수만큼 UPDATE 가 나가고, 탈퇴는 그럴 이유가 없는 작업이다.
     *
     * <p>⚠️ 벌크 연산이라 <b>영속성 컨텍스트를 거치지 않는다.</b> 같은 트랜잭션에서 이미
     * 읽어 둔 Ticket 이 있으면 그 객체는 옛 값을 들고 있다. 탈퇴 흐름은 티켓을 읽지 않으므로
     * 지금은 문제가 없지만, 이 뒤에 티켓을 읽는 코드를 붙이면 그 사실을 기억해야 한다.
     *
     * @return 지운 티켓 수 (0 이어도 정상 — 예매가 없던 회원이다)
     */
    @Modifying
    @Query("""
            UPDATE Ticket t
               SET t.faceEmbedding = NULL, t.faceModelVersion = NULL
             WHERE t.user.id = :userId
               AND t.faceEmbedding IS NOT NULL
            """)
    int eraseFaceOf(@Param("userId") Long userId);

    /** 단건도 같은 연관을 함께 읽는다 */
    @Query("""
            SELECT t FROM Ticket t
            JOIN FETCH t.performanceDetail pd
            JOIN FETCH pd.performance p
            JOIN FETCH p.stadium
            JOIN FETCH t.area
            LEFT JOIN FETCH t.seat
            WHERE t.id = :ticketId
            """)
    Optional<Ticket> findDetailById(@Param("ticketId") Long ticketId);

    /** 한 회차에 이 회원이 이미 가진 티켓 수 (1인 N매 정책 검사용) */
    long countByUserIdAndPerformanceDetailIdAndStatus(
            Long userId, Long performanceDetailId, TicketStatus status);

    /**
     * 공연의 구역별 판매량.
     *
     * <p>예전에는 performance_areas.sold_cnt 에 세어 두었지만, 그 컬럼은 회차 구분이 없어
     * 정원 통제에 못 쓰면서 값만 어긋났다. 판매량의 진실은 티켓이므로 필요할 때 센다 —
     * 쓰는 곳이 관리자 화면뿐이라 매번 세도 부담이 없다.
     *
     * <p>취소된 티켓은 빼야 한다. 취소는 좌석을 다시 풀어 주므로 판 것으로 볼 수 없다.
     */
    @Query("""
            SELECT t.area.id AS areaId, COUNT(t) AS soldCount
            FROM Ticket t
            WHERE t.performanceDetail.performance.id = :performanceId
              AND t.status = :status
            GROUP BY t.area.id
            """)
    List<AreaSoldCount> countByAreaForPerformance(@Param("performanceId") Long performanceId,
            @Param("status") TicketStatus status);

    /** 확정된 티켓만 센다 */
    default List<AreaSoldCount> countSoldByArea(Long performanceId) {
        return countByAreaForPerformance(performanceId, TicketStatus.CONFIRMED);
    }

    /** 구역별 판매량 한 줄 */
    interface AreaSoldCount {
        Long getAreaId();

        long getSoldCount();
    }

    /* ─────────────────────────────────────────────────────────────
       운영 좌석·예매자 화면 (PerformanceOperationsService)
       ───────────────────────────────────────────────────────────── */

    /**
     * 한 회차의 좌석 배정 — <b>좌석맵에 얹을 최소 정보</b>.
     *
     * <p>🔴 개인정보를 읽지 않는다. 좌석맵은 "이 자리가 팔렸나 · 들어왔나" 까지만 알면 되고,
     * 누가 앉는지는 그 좌석을 눌렀을 때 한 건씩 조회한다. 좌석 수천 개의 이름·연락처를
     * 한 응답에 싣지 않기 위한 경계다.
     *
     * <p>좌석은 스탠딩이면 없으므로 {@code LEFT JOIN} 이다. 암시적 조인({@code t.seat.id})을
     * 쓰면 내부 조인이 되어 <b>스탠딩 티켓이 통째로 빠진다</b> — 집계가 그만큼 모자라진다.
     */
    @Query("""
            SELECT t.id AS ticketId, a.id AS areaId, s.id AS seatId, t.checkedInAt AS checkedInAt
            FROM Ticket t
            JOIN t.area a
            LEFT JOIN t.seat s
            WHERE t.performanceDetail.id = :scheduleId
              AND t.status = :status
            """)
    List<SeatAssignment> findSeatAssignments(@Param("scheduleId") Long scheduleId,
            @Param("status") TicketStatus status);

    /** 유효한 예매만. 취소된 표는 자리를 비워 준 것이라 현재 예매자가 아니다 */
    default List<SeatAssignment> findConfirmedSeatAssignments(Long scheduleId) {
        return findSeatAssignments(scheduleId, TicketStatus.CONFIRMED);
    }

    /** {@link #findSeatAssignments} 결과 한 줄. 스탠딩이면 {@code seatId} 가 null 이다 */
    interface SeatAssignment {
        Long getTicketId();

        Long getAreaId();

        /** 스탠딩이면 null */
        Long getSeatId();

        /** 아직 입장하지 않았으면 null */
        LocalDateTime getCheckedInAt();
    }

    /**
     * 예매자 명단 한 페이지.
     *
     * <p>정렬·커서는 <b>티켓 번호 내림차순</b>이다. 검표가 진행되는 동안에도 경계가 움직이지
     * 않아야 하므로 입장 시각이나 offset 을 기준으로 삼지 않는다
     * ({@code OperationsAttendeePageResponse} 주석).
     *
     * <p>검색어는 <b>이름·닉네임</b>에 건다. 숫자만 넣었을 때는 티켓 번호로도 찾는다 —
     * 게이트에서 번호를 보고 명단을 확인하는 흐름이 있어서다({@code ticketIdKeyword}).
     *
     * <p>취소된 표도 함께 온다. 운영자가 보는 이유는 대개 "취소했다는데요" 이므로 거르면
     * 표를 볼 이유가 없어진다 — 상태 칩이 취소를 알려주고, 집계에서는 빠진다.
     */
    @Query("""
            SELECT t FROM Ticket t
            JOIN FETCH t.user u
            JOIN FETCH t.area a
            LEFT JOIN FETCH t.seat s
            WHERE t.performanceDetail.id = :scheduleId
              AND (:areaId IS NULL OR a.id = :areaId)
              AND (:checkedIn IS NULL
                   OR (:checkedIn = TRUE AND t.checkedInAt IS NOT NULL)
                   OR (:checkedIn = FALSE AND t.checkedInAt IS NULL))
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.nickname) LIKE :keyword
                   OR (:ticketIdKeyword IS NOT NULL AND t.id = :ticketIdKeyword))
              AND (:cursorId IS NULL OR t.id < :cursorId)
            ORDER BY t.id DESC
            """)
    List<Ticket> findAttendees(@Param("scheduleId") Long scheduleId,
            @Param("areaId") Long areaId,
            @Param("checkedIn") Boolean checkedIn,
            @Param("keyword") String keyword,
            @Param("ticketIdKeyword") Long ticketIdKeyword,
            @Param("cursorId") Long cursorId,
            Limit limit);

    /** 같은 조건의 전체 수. 페이지 이동에 쓰는 커서와 별개로 "몇 명인지" 를 보여준다 */
    @Query("""
            SELECT COUNT(t) FROM Ticket t
            JOIN t.user u
            JOIN t.area a
            WHERE t.performanceDetail.id = :scheduleId
              AND (:areaId IS NULL OR a.id = :areaId)
              AND (:checkedIn IS NULL
                   OR (:checkedIn = TRUE AND t.checkedInAt IS NOT NULL)
                   OR (:checkedIn = FALSE AND t.checkedInAt IS NULL))
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.nickname) LIKE :keyword
                   OR (:ticketIdKeyword IS NOT NULL AND t.id = :ticketIdKeyword))
            """)
    long countAttendees(@Param("scheduleId") Long scheduleId,
            @Param("areaId") Long areaId,
            @Param("checkedIn") Boolean checkedIn,
            @Param("keyword") String keyword,
            @Param("ticketIdKeyword") Long ticketIdKeyword);

    /**
     * 운영 화면이 여는 티켓 한 장. <b>회차까지 함께 검사한다.</b>
     *
     * <p>🔴 티켓 번호만으로 열면 담당 공연의 회차를 고른 뒤 남의 공연 티켓 번호를 넣어 조회할
     * 수 있다. 권한은 회차에 걸려 있으므로 조회 조건에도 회차가 있어야 한다.
     */
    @Query("""
            SELECT t FROM Ticket t
            JOIN FETCH t.user u
            JOIN FETCH t.performanceDetail pd
            JOIN FETCH pd.performance p
            JOIN FETCH t.area a
            LEFT JOIN FETCH t.seat s
            WHERE t.id = :ticketId
              AND pd.id = :scheduleId
            """)
    Optional<Ticket> findAttendeeInSchedule(@Param("ticketId") Long ticketId,
            @Param("scheduleId") Long scheduleId);
}
