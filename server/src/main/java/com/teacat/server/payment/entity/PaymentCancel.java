package com.teacat.server.payment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 카드 취소 한 건.
 *
 * <p>{@code payments.canceled_amount} 만으로는 "언제 얼마를 왜" 가 남지 않습니다. 토스 부분취소는
 * 여러 번 일어날 수 있어 이력을 따로 둡니다.
 *
 * <p>{@code idempotencyKey} 는 토스 취소 API 의 {@code Idempotency-Key} 헤더로 그대로 보냅니다.
 * <b>주문 하나에 대해 항상 같은 값이어야</b> 재시도해도 두 번 취소되지 않습니다 — 그래서
 * 무작위가 아니라 주문 번호에서 결정론적으로 만듭니다.
 */
@Entity
@Table(name = "payment_cancels")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PaymentCancel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false, updatable = false)
    private Payment payment;

    @Column(name = "amount", nullable = false, updatable = false)
    private Integer amount;

    @Column(name = "reason", nullable = false, length = 200, updatable = false)
    private String reason;

    @Column(name = "idempotency_key", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID idempotencyKey;

    /** 토스가 준 취소 건 식별자. 대사용이라 응답이 없어도 취소 자체는 유효하다 */
    @Column(name = "transaction_key", length = 64)
    private String transactionKey;

    @CreationTimestamp
    @Column(name = "canceled_at", nullable = false, updatable = false)
    private LocalDateTime canceledAt;

    private PaymentCancel(Payment payment, int amount, String reason, UUID idempotencyKey,
            String transactionKey) {
        this.payment = payment;
        this.amount = amount;
        this.reason = reason;
        this.idempotencyKey = idempotencyKey;
        this.transactionKey = transactionKey;
    }

    public static PaymentCancel of(Payment payment, int amount, String reason, UUID idempotencyKey,
            String transactionKey) {
        return new PaymentCancel(payment, amount, reason, idempotencyKey, transactionKey);
    }
}
