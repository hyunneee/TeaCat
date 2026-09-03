package com.teacat.server.wallet.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
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
 * 가입 축하금(캣머니) 발행 내역.
 *
 * 체인 트랜잭션은 보낸 즉시 확정되지 않는다(SSAFY 체인 블록 10초).
 * 보냈다는 사실과 txHash 를 남겨 두어야 나중에 확정 여부를 확인할 수 있다.
 */
@Entity
@Table(name = "wallet_seed_grants")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WalletSeedGrant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id", nullable = false)
    private Wallet wallet;

    /** 캣머니는 decimals = 0 이라 소수가 없다 */
    @Column(name = "amount", nullable = false, updatable = false)
    private BigInteger amount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "wallet_seed_status")
    private WalletSeedStatus status;

    /** 이미 발행돼 있던 경우에는 새 트랜잭션이 없어 null. DB 는 char(66) */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "tx_hash", length = 66)
    private String txHash;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private WalletSeedGrant(Wallet wallet, BigInteger amount, WalletSeedStatus status, String txHash) {
        this.wallet = wallet;
        this.amount = amount;
        this.status = status;
        this.txHash = txHash;
    }

    public static WalletSeedGrant of(Wallet wallet, BigInteger amount, WalletSeedStatus status, String txHash) {
        return new WalletSeedGrant(wallet, amount, status, txHash);
    }

    /** 확정 폴링이 붙으면 여기서 상태를 올린다 */
    public void confirm() {
        this.status = WalletSeedStatus.CONFIRMED;
    }
}
