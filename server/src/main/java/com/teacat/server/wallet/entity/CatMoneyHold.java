package com.teacat.server.wallet.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 캣머니 홀드 한 건.
 *
 * ACTIVE 인 동안 그 금액은 가용 잔액에서 빠진다. 상태 전이는 ACTIVE → RELEASED | CAPTURED 한 번뿐이다.
 * 전이 메서드는 이미 끝난 홀드에 대해 false 를 돌려주고 아무것도 바꾸지 않는다(멱등).
 */
@Entity
@Table(name = "cat_money_holds")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CatMoneyHold {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** users.id — 연관을 걷지 않으므로 id 만 둔다 */
    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "amount", nullable = false, updatable = false)
    private long amount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "ref_type", nullable = false, updatable = false, columnDefinition = "cat_money_hold_ref_type")
    private CatMoneyHoldRefType refType;

    @Column(name = "ref_id", nullable = false, updatable = false)
    private Long refId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "cat_money_hold_status")
    private CatMoneyHoldStatus status;

    /** CAPTURED 로 바뀔 때 보낸 체인 트랜잭션. transfer 연동 전에는 null. DB 는 char(66) */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "capture_tx_hash", length = 66)
    private String captureTxHash;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private CatMoneyHold(Long userId, long amount, CatMoneyHoldRefType refType, Long refId) {
        this.userId = userId;
        this.amount = amount;
        this.refType = refType;
        this.refId = refId;
        this.status = CatMoneyHoldStatus.ACTIVE;
    }

    public static CatMoneyHold create(Long userId, long amount, CatMoneyHoldRefType refType, Long refId) {
        return new CatMoneyHold(userId, amount, refType, refId);
    }

    /** @return 이 호출로 상태가 바뀌었으면 true. 이미 끝난 홀드면 false */
    public boolean release() {
        if (status != CatMoneyHoldStatus.ACTIVE) {
            return false;
        }
        this.status = CatMoneyHoldStatus.RELEASED;
        return true;
    }

    /** @return 이 호출로 상태가 바뀌었으면 true. 이미 끝난 홀드면 false */
    public boolean capture() {
        if (status != CatMoneyHoldStatus.ACTIVE) {
            return false;
        }
        this.status = CatMoneyHoldStatus.CAPTURED;
        return true;
    }

    public void recordCaptureTx(String txHash) {
        if (status == CatMoneyHoldStatus.ACTIVE && txHash != null) {
            this.captureTxHash = txHash;
        }
    }

    public boolean isActive() {
        return status == CatMoneyHoldStatus.ACTIVE;
    }
}
