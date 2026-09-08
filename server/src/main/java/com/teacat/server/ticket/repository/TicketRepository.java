package com.teacat.server.ticket.repository;

import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.ticket.entity.TicketStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    List<Ticket> findByUserIdOrderByIdDesc(Long userId, Limit limit);

    /** 한 회차에 이 회원이 이미 가진 티켓 수 (1인 N매 정책 검사용) */
    long countByUserIdAndPerformanceDetailIdAndStatus(
            Long userId, Long performanceDetailId, TicketStatus status);
}
