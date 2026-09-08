package com.teacat.server.payment.entity;

import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.entity.Seat;
import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.user.entity.User;
import com.teacat.server.wallet.entity.CatTransaction;
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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigInteger;
import java.time.LocalDateTime;

/**
 * 티켓 주문 한 건.
 *
 * <p>티켓 값은 <b>캣머니 사용분과 카드 결제분으로 갈립니다.</b> 둘 다 여기서 확정되고,
 * 그 뒤로는 바뀌지 않습니다 — 가격이 나중에 변해도 이 주문이 얼마짜리였는지는 남아야 합니다.
 *
 * <pre>
 *   PENDING  금액 확정, 좌석은 아직 HELD. 이 몫만큼 캣머니 가용액이 줄어든다
 *   PAID     카드 승인 + 티켓 발권 완료. 소각은 뒤따라간다
 *   FAILED   승인 거절
 *   CANCELED 예매 취소
 * </pre>
 *
 * <p>카드로 낼 금액이 0원이면(캣머니가 전액을 덮으면) {@code payment} 가 없습니다 —
 * 토스는 0원 결제를 받지 않기 때문입니다. DB CHECK 이 이 규칙을 강제합니다.
 */
@Entity
@Table(name = "ticket_orders")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TicketOrder {

    /** 체인 멱등 키 접두어. 값은 우리 PK 라 추측돼도 안전하다 (비밀값을 넣으면 안 된다) */
    private static final String BURN_KEY_PREFIX = "order:";
    private static final String REFUND_KEY_PREFIX = "order-refund:";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "performance_detail_id", nullable = false, updatable = false)
    private PerformanceDetail performanceDetail;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "area_id", nullable = false, updatable = false)
    private Area area;

    /** 스탠딩이면 null */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_id", updatable = false)
    private Seat seat;

    /** 티켓 가격(원). 주문 시점의 performance_areas.price 를 복사한다 */
    @Column(name = "total_amount", nullable = false, updatable = false)
    private Integer totalAmount;

    /** 캣머니로 낼 금액. 캣머니는 원화와 1:1 이라 단위가 같다 */
    @Column(name = "token_amount", nullable = false, updatable = false)
    private Integer tokenAmount;

    /** 카드로 낼 금액. 0 이면 payment 가 없다 */
    @Column(name = "cash_amount", nullable = false, updatable = false)
    private Integer cashAmount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "ticket_order_status")
    private TicketOrderStatus status;

    /** 전액 캣머니 결제면 null */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id", updatable = false)
    private Payment payment;

    /** 결제 시 소각. 카드 승인이 끝난 뒤에 보낸다 */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "burn_tx_id")
    private CatTransaction burnTx;

    /** 취소 시 환급(발행) */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "refund_tx_id")
    private CatTransaction refundTx;

    /** 발권된 티켓. PAID 가 되는 순간 채워진다 */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private TicketOrder(User user, PerformanceDetail performanceDetail, Area area, Seat seat,
            int totalAmount, int tokenAmount, Payment payment) {
        this.user = user;
        this.performanceDetail = performanceDetail;
        this.area = area;
        this.seat = seat;
        this.totalAmount = totalAmount;
        this.tokenAmount = tokenAmount;
        this.cashAmount = totalAmount - tokenAmount;
        this.payment = payment;
        this.status = TicketOrderStatus.PENDING;
    }

    /**
     * 주문을 연다. 금액 분해가 여기서 확정된다.
     *
     * @param tokenAmount 캣머니로 낼 금액. 호출자가 가용액을 확인한 뒤 넘긴다
     * @param payment     카드로 낼 금액이 있을 때만. 없으면 null
     */
    public static TicketOrder open(User user, PerformanceDetail performanceDetail, Area area, Seat seat,
            int totalAmount, int tokenAmount, Payment payment) {
        return new TicketOrder(user, performanceDetail, area, seat, totalAmount, tokenAmount, payment);
    }

    /** 결제가 끝나고 티켓이 발권됐다 */
    public void markPaid(Ticket ticket) {
        this.ticket = ticket;
        this.status = TicketOrderStatus.PAID;
        this.paidAt = LocalDateTime.now();
    }

    public void markFailed() {
        this.status = TicketOrderStatus.FAILED;
    }

    public void markCanceled() {
        this.status = TicketOrderStatus.CANCELED;
    }

    public void recordBurn(CatTransaction burnTx) {
        this.burnTx = burnTx;
    }

    public void recordRefund(CatTransaction refundTx) {
        this.refundTx = refundTx;
    }

    /** 캣머니를 쓰는 주문인가 */
    public boolean usesToken() {
        return tokenAmount > 0;
    }

    /** 카드 결제가 필요한 주문인가. 아니면 토스를 부르지 않는다 */
    public boolean requiresCardPayment() {
        return cashAmount > 0;
    }

    public boolean isPending() {
        return status == TicketOrderStatus.PENDING;
    }

    public boolean isOwnedBy(Long userId) {
        return user.getId().equals(userId);
    }

    /** 소각을 이미 보냈는가 */
    public boolean isBurnSent() {
        return burnTx != null;
    }

    public BigInteger burnAmount() {
        return BigInteger.valueOf(tokenAmount);
    }

    /** 소각 멱등 키. 재시도해도 같은 값이어야 두 번 태우지 않는다 */
    public String burnOperationKey() {
        return BURN_KEY_PREFIX + id;
    }

    /** 환급 멱등 키. 소각과 달라야 한다 — 같으면 환급이 소각으로 오인된다 */
    public String refundOperationKey() {
        return REFUND_KEY_PREFIX + id;
    }
}
