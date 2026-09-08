package com.teacat.server.payment.repository;

import com.teacat.server.payment.entity.TicketOrder;
import com.teacat.server.payment.entity.TicketOrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

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
}
