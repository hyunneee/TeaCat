package com.teacat.server.payment.repository;

import com.teacat.server.payment.entity.TicketOrder;
import com.teacat.server.payment.entity.TicketOrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TicketOrderRepository extends JpaRepository<TicketOrder, Long> {

    Optional<TicketOrder> findByPaymentId(Long paymentId);

    /**
     * 발권된 티켓으로 주문을 되찾는다.
     *
     * <p>내 티켓 화면이 결제 금액을 보여주고 <b>취소 버튼을 만들 때</b> 쓴다. 취소는 티켓이
     * 아니라 주문 단위라({@code POST /payments/ticket-orders/{id}/cancel}) 티켓만 알아서는
     * 취소를 걸 수 없다.
     *
     * <p>티켓 하나에 주문도 하나다 — 주문이 PAID 가 될 때 그 주문이 티켓을 발권한다.
     * 취소된 주문도 {@code ticket_id} 를 그대로 들고 있어(제약 {@code chk_ticket_orders_paid})
     * 취소 뒤에도 같은 주문을 찾을 수 있다.
     */
    Optional<TicketOrder> findByTicketId(Long ticketId);

    /** 목록용. 티켓마다 따로 조회하면 N+1 이 된다 */
    List<TicketOrder> findByTicketIdIn(Collection<Long> ticketIds);

    /**
     * 승인 선점용 조회. 행을 잠그고 읽어야 두 요청이 동시에 PENDING 을 보고 둘 다 승인을
     * 보내는 일을 막을 수 있다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TicketOrder> findWithLockById(Long id);

    /** 이 좌석에 결제 대기 중인 주문. 부분 유니크 인덱스가 있어 최대 하나다 */
    Optional<TicketOrder> findByPerformanceDetail_IdAndSeat_IdAndStatus(
            Long performanceDetailId, Long seatId, TicketOrderStatus status);

    /**
     * 좌석 선점을 잃은 채 남은 결제 대기 주문. 정리 배치가 따라간다.
     *
     * <p>정리하지 않으면 두 가지가 굳는다 — 묶어둔 캣머니가 영영 풀리지 않고,
     * {@code uq_ticket_orders_pending_seat} 때문에 <b>그 좌석으로는 누구도 주문을 열 수 없다.</b>
     *
     * <p>승인을 한 번이라도 보낸 주문(payments 가 READY 가 아니다)은 건드리지 않는다. 승인은 됐는데
     * 발권이 막힌 주문을 다시 승인해 되살리는 길이 있는데, FAILED 로 닫아 버리면 그 길이 막힌다.
     *
     * <p>좌석이 없는 주문(스탠딩)은 선점으로 판단할 수 없어 JOIN 에서 빠진다.
     */
    @Query(value = """
            SELECT o.id
              FROM ticket_orders o
              JOIN performance_seats ps
                ON ps.performance_detail_id = o.performance_detail_id
               AND ps.seat_id = o.seat_id
              LEFT JOIN payments p ON p.id = o.payment_id
             WHERE o.status = 'PENDING'
               AND (p.id IS NULL OR p.status = 'READY')
               AND (ps.status <> 'HELD'
                    OR ps.held_by <> o.user_id
                    OR ps.held_until < now())
             ORDER BY o.id
             LIMIT :limit
            """, nativeQuery = true)
    List<Long> findStalePendingOrderIds(@Param("limit") int limit);

    /** 소각을 못 보낸 결제 완료 주문 (재시도 대상) */
    List<TicketOrder> findByStatusAndBurnTxIsNullAndTokenAmountGreaterThanOrderByIdAsc(
            TicketOrderStatus status, int minTokenAmount, Limit limit);

    /** 캣머니 환급이 아직 안 나간 취소 주문 */
    List<TicketOrder> findByStatusAndRefundTxIsNullAndTokenAmountGreaterThanOrderByIdAsc(
            TicketOrderStatus status, int minTokenAmount, Limit limit);

    /**
     * 카드 취소가 아직 안 끝난 취소 주문.
     *
     * <p>{@code canceled_amount} 가 결제 금액에 못 미치면 아직 돌려주지 않은 돈이 있다는 뜻이다.
     * 환불은 반드시 끝나야 하므로 배치가 이 목록을 따라간다.
     */
    @Query("""
            SELECT o.id FROM TicketOrder o
            JOIN o.payment p
            WHERE o.status = :status
              AND p.canceledAmount < p.amount
            ORDER BY o.id
            """)
    List<Long> findWithUnrefundedCard(@Param("status") TicketOrderStatus status, Limit limit);

    /**
     * enum 은 파라미터로 넘긴다. JPQL 리터럴로 쓰면 Hibernate 가 자바 클래스명으로 캐스팅을
     * 만들어 Postgres 의 실제 타입명과 어긋난다.
     */
    default List<Long> findCanceledWithUnrefundedCard(Limit limit) {
        return findWithUnrefundedCard(TicketOrderStatus.CANCELED, limit);
    }
}
