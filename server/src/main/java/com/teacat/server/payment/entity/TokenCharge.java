package com.teacat.server.payment.entity;

import com.teacat.server.user.entity.User;
import com.teacat.server.wallet.entity.CatTransaction;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigInteger;
import java.time.LocalDateTime;

/**
 * 캣머니 충전 한 건.
 *
 * <p>결제 승인으로 끝나지 않습니다. 그 다음 체인 발행이 있고 확정은 비동기입니다. 그래서
 * {@link Payment} 와 1:1 이면서도 행을 따로 둡니다.
 *
 * <p><b>발행을 보내기 전에 이 행을 먼저 커밋합니다.</b> 그래야 그 사이에 서버가 죽어도
 * {@code mintTx IS NULL} 로 남아 재발행 대상이 됩니다. 반대로 하면 승인은 됐는데 아무 기록도
 * 없는 상태가 생깁니다.
 */
@Entity
@Table(name = "token_charges")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TokenCharge {

    /** 체인 멱등 키 접두어. 값은 우리 PK 라 추측돼도 안전하다 (비밀값을 넣으면 안 된다) */
    private static final String OPERATION_KEY_PREFIX = "charge:";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false, updatable = false)
    private Payment payment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    /**
     * 지급할 캣머니. 지금은 원화와 1:1 이지만 보너스·프로모션이 붙으면 갈라지므로
     * {@code payment.amount} 를 그대로 읽지 않고 확정한 값을 남긴다.
     */
    @Column(name = "amount", nullable = false, updatable = false)
    private Long amount;

    /** 발행 트랜잭션. 아직 못 보냈으면 null 이고 재발행 대상이다 */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mint_tx_id")
    private CatTransaction mintTx;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private TokenCharge(Payment payment, User user, long amount) {
        this.payment = payment;
        this.user = user;
        this.amount = amount;
    }

    /** 승인된 결제만큼 캣머니를 지급하기로 확정한다. 발행은 아직 보내지 않았다 */
    public static TokenCharge of(Payment payment, User user, long amount) {
        return new TokenCharge(payment, user, amount);
    }

    public void recordMint(CatTransaction mintTx) {
        this.mintTx = mintTx;
    }

    /**
     * 이 충전의 체인 멱등 키. 같은 키로 몇 번을 보내도 컨트랙트가 두 번 발행하지 않으므로
     * 재발행이 안전하다.
     */
    public String operationKey() {
        return OPERATION_KEY_PREFIX + id;
    }

    public BigInteger mintAmount() {
        return BigInteger.valueOf(amount);
    }

    public boolean isMintSent() {
        return mintTx != null;
    }

    public boolean isOwnedBy(Long userId) {
        return user.getId().equals(userId);
    }
}
