package com.teacat.server.payment.repository;

import com.teacat.server.payment.entity.TicketOrder;
import com.teacat.server.payment.entity.TicketOrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TicketOrderRepository extends JpaRepository<TicketOrder, Long> {

    Optional<TicketOrder> findByPaymentId(Long paymentId);

    /**
     * 승인 선점용 조회. 행을 잠그고 읽어야 두 요청이 동시에 PENDING 을 보고 둘 다 승인을
     * 보내는 일을 막을 수 있다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TicketOrder> findWithLockById(Long id);

    /** 결제가 끝나지 않은 채 남은 주문. 좌석 선점이 만료되면 정리 대상이다 */
    List<TicketOrder> findByStatusOrderByIdAsc(TicketOrderStatus status, Limit limit);

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
