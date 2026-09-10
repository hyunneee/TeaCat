package com.teacat.server.ticket.repository;

import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.ticket.entity.TicketStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    /**
     * 내 티켓 목록.
     *
     * <p>공연·구역·좌석을 함께 읽는다. 응답에 전부 필요한 값이라 지연 로딩으로 두면 티켓 수만큼
     * 쿼리가 늘어난다. 좌석은 스탠딩이면 없으므로 LEFT JOIN 이다.
     */
    @Query("""
            SELECT t FROM Ticket t
            JOIN FETCH t.performanceDetail pd
            JOIN FETCH pd.performance pg
            JOIN FETCH pg.stadium
            JOIN FETCH t.area
            LEFT JOIN FETCH t.seat
            WHERE t.user.id = :userId
            ORDER BY t.id DESC
            """)
    List<Ticket> findMyTickets(@Param("userId") Long userId, Limit limit);

    /** 단건도 같은 연관을 함께 읽는다 */
    @Query("""
            SELECT t FROM Ticket t
            JOIN FETCH t.performanceDetail pd
            JOIN FETCH pd.performance pg
            JOIN FETCH pg.stadium
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
}
