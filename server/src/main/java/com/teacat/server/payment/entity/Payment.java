package com.teacat.server.payment.entity;

import com.teacat.server.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 토스 결제 한 건. 충전과 티켓 결제가 이 테이블을 함께 씁니다.
 *
 * <p><b>금액은 결제를 시작할 때 서버가 확정합니다.</b> 승인 요청에 프론트가 실어 보낸 금액을
 * 이 값과 대조하지 않으면 5만원짜리를 100원에 승인시킬 수 있습니다.
 */
@Entity
@Table(name = "payments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Payment {

    /** 주문번호 접두어. 대사할 때 눈으로 목적을 구분하려고 붙인다 */
    private static final String ORDER_ID_PREFIX = "tc_";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 토스에 넘기는 주문번호.
     *
     * 추측 가능하면 남의 주문번호로 승인을 시도할 수 있어 UUID 를 쓴다.
     * (토스 제약: 6~64자, 영문·숫자·'-'·'_')
     */
    @Column(name = "order_id", nullable = false, length = 64, updatable = false)
    private String orderId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "purpose", nullable = false, updatable = false, columnDefinition = "payment_purpose")
    private PaymentPurpose purpose;

    /** 결제 금액(원). 서버가 확정한 값이고 승인 때 토스 응답과 대조한다 */
    @Column(name = "amount", nullable = false, updatable = false)
    private Integer amount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "payment_status")
    private PaymentStatus status;

    /** 승인 이후에만 채워진다. 토스가 발급하는 결제 식별자이고 취소·조회의 키다 */
    @Column(name = "payment_key", length = 200)
    private String paymentKey;

    @Column(name = "method", length = 30)
    private String method;

    @Column(name = "receipt_url")
    private String receiptUrl;

    @Column(name = "canceled_amount", nullable = false)
    private Integer canceledAmount;

    @Column(name = "failure_code", length = 50)
    private String failureCode;

    @Column(name = "failure_message", length = 255)
    private String failureMessage;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private Payment(String orderId, User user, PaymentPurpose purpose, int amount) {
        this.orderId = orderId;
        this.user = user;
        this.purpose = purpose;
        this.amount = amount;
        this.status = PaymentStatus.READY;
        this.canceledAmount = 0;
    }

    /** 결제 시작. 주문번호와 금액이 여기서 확정된다 */
    public static Payment ready(User user, PaymentPurpose purpose, int amount) {
        return new Payment(ORDER_ID_PREFIX + UUID.randomUUID(), user, purpose, amount);
    }

    /**
     * 승인 요청 직전 선점. 이 상태로 커밋해야 중복 승인을 막고, 서버가 죽어도 복구 대상으로 남는다.
     *
     * @return 선점했으면 true, 이미 다른 요청이 가져갔으면 false
     */
    public boolean claimForApproval() {
        if (status != PaymentStatus.READY) {
            return false;
        }

        this.status = PaymentStatus.IN_PROGRESS;
        return true;
    }

    /** 토스 승인 완료 */
    public void approve(String paymentKey, String method, String receiptUrl, LocalDateTime approvedAt) {
        this.status = PaymentStatus.DONE;
        this.paymentKey = paymentKey;
        this.method = method;
        this.receiptUrl = receiptUrl;
        this.approvedAt = approvedAt;
        this.failureCode = null;
        this.failureMessage = null;
    }

    /** 승인이 거절됐다. 사유는 토스가 준 코드를 그대로 남긴다 */
    public void abort(String failureCode, String failureMessage) {
        this.status = PaymentStatus.ABORTED;
        this.failureCode = failureCode;
        this.failureMessage = truncate(failureMessage);
    }

    public boolean isOwnedBy(Long userId) {
        return user.getId().equals(userId);
    }

    public boolean isDone() {
        return status == PaymentStatus.DONE;
    }

    public boolean matchesAmount(int requestedAmount) {
        return amount == requestedAmount;
    }

    /** DB 는 varchar(255) 다. 토스 메시지가 길어도 승인 기록을 잃으면 안 된다 */
    private static String truncate(String message) {
        if (message == null || message.length() <= 255) {
            return message;
        }
        return message.substring(0, 255);
    }
}
