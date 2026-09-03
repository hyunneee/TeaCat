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
import jakarta.persistence.OneToOne;
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
 * 유저의 소유 키(EOA).
 *
 * 개인키는 저장하지 않는다. 니모닉 + {@code derivationIndex} 로 매번 파생하므로
 * <b>이 인덱스가 곧 유저의 키</b>다. 값을 고치거나 재사용하면 다른 사람의 자산이 딸려 온다.
 * (blockchain/DESIGN.md 5-1)
 */
@Entity
@Table(name = "wallet_owners")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WalletOwner {

    /** 지금 쓰는 마스터 니모닉 세대. 니모닉을 교체하면 올린다 */
    public static final short CURRENT_KEY_VERSION = 1;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "derivation_index", nullable = false, updatable = false)
    private Integer derivationIndex;

    /** 소문자 0x 주소. DB 는 char(42) 이고 소문자 CHECK 이 걸려 있다 */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "owner_address", nullable = false, length = 42, updatable = false)
    private String ownerAddress;

    @Column(name = "key_version", nullable = false)
    private Short keyVersion;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "wallet_owner_status")
    private WalletOwnerStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private WalletOwner(User user, Integer derivationIndex, String ownerAddress) {
        this.user = user;
        this.derivationIndex = derivationIndex;
        this.ownerAddress = ownerAddress;
        this.keyVersion = CURRENT_KEY_VERSION;
        this.status = WalletOwnerStatus.ACTIVE;
    }

    public static WalletOwner create(User user, int derivationIndex, String ownerAddress) {
        return new WalletOwner(user, derivationIndex, ownerAddress);
    }
}
