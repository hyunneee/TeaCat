package com.teacat.server.payment.repository;

import com.teacat.server.payment.entity.Payment;
import com.teacat.server.payment.entity.PaymentStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByOrderId(String orderId);

    /**
     * 승인 선점용 조회.
     *
     * <p>행을 잠그고 읽어야 두 요청이 동시에 {@code READY} 를 보고 둘 다 토스로 승인을 보내는
     * 일을 막을 수 있다. 상태만 보고 UPDATE 하면 그 사이에 다른 요청이 끼어든다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Payment> findWithLockByOrderId(String orderId);

    /** 승인 결과를 모른 채 남은 결제. 토스에 되물어 상태를 맞춘다 */
    List<Payment> findByStatusInAndCreatedAtBeforeOrderByIdAsc(
            List<PaymentStatus> statuses, LocalDateTime createdBefore, Limit limit);
}
