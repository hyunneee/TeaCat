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

/**
 * 체인별 지갑.
 *
 * 릴레이어 단계(RELAYER_EOA)에서는 지갑 주소가 곧 소유 EOA 주소이고,
 * 배포가 필요 없으므로 만들자마자 ACTIVE 다. 4337 관련 컬럼 6개는 전부 NULL 이어야 한다.
 * (blockchain/DESIGN.md 5-3)
 */
@Entity
@Table(name = "wallets")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private WalletOwner owner;

    @Column(name = "chain_id", nullable = false, updatable = false)
    private Integer chainId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "type", nullable = false, columnDefinition = "wallet_type")
    private WalletType type;

    /** 소문자 0x 주소. DB 는 char(42) 이고 소문자 CHECK 이 걸려 있다 */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "address", nullable = false, length = 42, updatable = false)
    private String address;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "wallet_status")
    private WalletStatus status;

    @Column(name = "deployed", nullable = false)
    private boolean deployed;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private Wallet(WalletOwner owner, Integer chainId, String address) {
        this.owner = owner;
        this.chainId = chainId;
        this.address = address;
        this.type = WalletType.RELAYER_EOA;
        this.status = WalletStatus.ACTIVE;
        this.deployed = false;
    }

    /** 릴레이어 EOA 지갑. 주소는 소유 EOA 와 같고 배포 과정이 없다 */
    public static Wallet relayerEoa(WalletOwner owner, int chainId, String address) {
        return new Wallet(owner, chainId, address);
    }
}
