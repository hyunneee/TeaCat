package com.teacat.server.wallet.entity;

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

import java.math.BigInteger;
import java.time.LocalDateTime;

/**
 * 캣머니 발행·소각 요청과 그 확정 여부.
 *
 * <p><b>잔액이 아닙니다.</b> 잔액은 저장하지 않습니다 — 체인이 진실이고 캐시하면 반드시
 * 어긋납니다 (blockchain/DESIGN.md 5-3). 이 테이블은 "우리가 무엇을 보냈고 확정됐는가" 만 담습니다.
 *
 * <p>그런데도 필요한 이유는, 체인 잔액만으로는 결제를 판정할 수 없기 때문입니다. 소각을 보내고
 * 확정되기까지 블록 하나(10초)가 걸리는데 그 사이 체인 잔액은 예전 값이라, 포카 마켓 구매와
 * 티켓 결제가 같은 잔액을 두 번 쓸 수 있습니다. 그래서 가용액을 계산할 때
 * {@link CatTxStatus#PENDING} 인 소각을 빼줍니다.
 */
@Entity
@Table(name = "cat_transactions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CatTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wallet_id", nullable = false, updatable = false)
    private Wallet wallet;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "direction", nullable = false, updatable = false, columnDefinition = "cat_tx_direction")
    private CatTxDirection direction;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "reason", nullable = false, updatable = false, columnDefinition = "cat_tx_reason")
    private CatTxReason reason;

    /** 캣머니는 decimals = 0 이라 소수가 없다 */
    @Column(name = "amount", nullable = false, updatable = false)
    private BigInteger amount;

    /**
     * 체인 멱등 키. 같은 키로 다시 보내도 컨트랙트가 재실행을 막아준다 (blockchain/DESIGN.md 4-3).
     *
     * <p>비밀값을 넣으면 안 된다 — keccak256 해시가 체인에 영구히 남는다. 우리 PK 를 쓴다.
     */
    @Column(name = "operation_key", nullable = false, length = 200, updatable = false)
    private String operationKey;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "cat_tx_status")
    private CatTxStatus status;

    /** 이미 처리돼 있던 경우에는 새 트랜잭션이 없어 null. DB 는 char(66) */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "tx_hash", length = 66)
    private String txHash;

    @Column(name = "failure_code", length = 50)
    private String failureCode;

    /** PENDING 이면 반드시 null 이다 (DB CHECK) */
    @Column(name = "settled_at")
    private LocalDateTime settledAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private CatTransaction(User user, Wallet wallet, CatTxReason reason, BigInteger amount,
            String operationKey, CatTxStatus status, String txHash) {
        this.user = user;
        this.wallet = wallet;
        this.direction = reason.direction();
        this.reason = reason;
        this.amount = amount;
        this.operationKey = operationKey;
        this.status = status;
        this.txHash = txHash;
        this.settledAt = status.isSettled() ? LocalDateTime.now() : null;
    }

    /** 트랜잭션을 보냈고 아직 확정을 못 봤다. 확정은 폴링이 채운다 */
    public static CatTransaction sent(User user, Wallet wallet, CatTxReason reason, BigInteger amount,
            String operationKey, String txHash) {
        return new CatTransaction(user, wallet, reason, amount, operationKey, CatTxStatus.PENDING, txHash);
    }

    /** 컨트랙트에 이미 실행돼 있어 새 트랜잭션이 나가지 않았다. 재시도했을 때의 정상 응답이다 */
    public static CatTransaction alreadyDone(User user, Wallet wallet, CatTxReason reason, BigInteger amount,
            String operationKey) {
        return new CatTransaction(user, wallet, reason, amount, operationKey, CatTxStatus.ALREADY_DONE, null);
    }

    /**
     * 체인 확정 결과를 반영한다.
     *
     * <p>이미 결론이 난 건은 건드리지 않는다. 폴링이 겹쳐 돌아도 결과가 뒤집히지 않아야 한다.
     */
    public void settle(CatTxStatus settledStatus, String failureCode) {
        if (this.status.isSettled() || !settledStatus.isSettled()) {
            return;
        }

        this.status = settledStatus;
        this.failureCode = failureCode;
        this.settledAt = LocalDateTime.now();
    }

    public boolean isPending() {
        return status == CatTxStatus.PENDING;
    }
}
