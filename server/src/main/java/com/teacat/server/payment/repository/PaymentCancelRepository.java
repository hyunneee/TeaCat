package com.teacat.server.payment.repository;

import com.teacat.server.payment.entity.PaymentCancel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PaymentCancelRepository extends JpaRepository<PaymentCancel, Long> {

    /**
     * 이미 기록된 취소인가.
     *
     * <p>멱등 키가 주문 번호에서 결정론적으로 나오므로, 재시도로 다시 들어와도 이 조회가
     * 먼저 걸러낸다. DB 의 UNIQUE 제약이 최종 방어선이다.
     */
    Optional<PaymentCancel> findByIdempotencyKey(UUID idempotencyKey);
}
