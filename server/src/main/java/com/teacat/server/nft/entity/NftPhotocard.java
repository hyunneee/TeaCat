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

    /** 카드를 받은 지갑. <b>발행을 보내기 전에 반드시 채워져 있어야 한다</b> — 받는 주소가 여기서 나온다 */
    @Column(name = "wallet_id")
    private Long walletId;

    /*
     * ── 아래 여섯 개는 블록체인 서비스가 쓴다 (blockchain/DESIGN.md 1장 예외) ──────
     *
     * 확정을 Spring 대신 그쪽이 기다려서 이 행을 직접 UPDATE 한다. 그래서 전부
     * updatable = false 다. 안 그러면 로드해 둔 이 엔티티가 flush 되면서
     * <b>방금 기록된 민팅 결과를 옛 값으로 되돌린다</b> — 카드가 영원히 PENDING 으로
     * 남고, 원인은 한참 뒤에나 드러난다. (PHOTOCARD_PLAN.md 6-4)
     *
     * INSERT 는 막히지 않으므로 status 는 PENDING 으로 처음 저장된다.
     * 그 뒤 PENDING → MINTING → MINTED 는 전부 저쪽이 옮긴다.
     */

    @Column(name = "chain_id", updatable = false)
    private Integer chainId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "contract_address", length = 42, columnDefinition = "char(42)", updatable = false)
    private String contractAddress;

    /** {@code design_id} 와 같은 값이다. 포카의 tokenId 는 카드가 아니라 도안이다 */
    @Column(name = "token_id", precision = 78, updatable = false)
    private BigDecimal tokenId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "mint_tx_hash", length = 66, columnDefinition = "char(66)", updatable = false)
    private String mintTxHash;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "nft_mint_status", updatable = false)
    private NftMintStatus status;

    @Column(name = "minted_at", updatable = false)
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
