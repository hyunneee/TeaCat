package com.teacat.server.nft.entity;

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

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "nft_photocards")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "design_id", nullable = false)
    private NftPhotocardDesign design;

    @Column(name = "ticket_id", nullable = false, updatable = false)
    private Long ticketId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "wallet_id")
    private Long walletId;

    @Column(name = "metadata_uri")
    private String metadataUri;

    @Column(name = "chain_id")
    private Integer chainId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "contract_address", length = 42, columnDefinition = "char(42)")
    private String contractAddress;

    @Column(name = "token_id", precision = 78)
    private BigDecimal tokenId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "mint_tx_hash", length = 66, columnDefinition = "char(66)")
    private String mintTxHash;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "nft_mint_status")
    private NftMintStatus status;

    @Column(name = "minted_at")
    private LocalDateTime mintedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private NftPhotocard(NftPhotocardDesign design, Long ticketId, User owner) {
        this.design = design;
        this.ticketId = ticketId;
        this.owner = owner;
        this.status = NftMintStatus.PENDING;
    }

    public static NftPhotocard issue(NftPhotocardDesign design, Long ticketId, User owner) {
        return new NftPhotocard(design, ticketId, owner);
    }

    public void transferTo(User buyer) {
        this.owner = buyer;
        // TODO(blockchain): 온체인 연동 시 현재 소유자의 지갑으로 transferFrom을 요청하고 walletId를 갱신한다.
    }

    public boolean isOwnedBy(Long userId) {
        return owner.getId().equals(userId);
    }
}
