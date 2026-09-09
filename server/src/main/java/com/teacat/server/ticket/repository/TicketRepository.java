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
            JOIN FETCH pd.performance
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
            JOIN FETCH pd.performance
            JOIN FETCH t.area
            LEFT JOIN FETCH t.seat
            WHERE t.id = :ticketId
            """)
    Optional<Ticket> findDetailById(@Param("ticketId") Long ticketId);

    /** 한 회차에 이 회원이 이미 가진 티켓 수 (1인 N매 정책 검사용) */
    long countByUserIdAndPerformanceDetailIdAndStatus(
            Long userId, Long performanceDetailId, TicketStatus status);
}
