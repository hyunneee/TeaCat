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

    /** 개별 카드의 온체인 발행 키. 신규 카드는 UUID, 제출된 레거시 카드는 기존 숫자 문자열이다. */
    @Column(name = "issue_key", length = 64, updatable = false)
    private String issueKey;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "design_id", nullable = false)
    private NftPhotocardDesign design;

    /** 공연 발급 카드의 티켓. 뽑기 카드는 null 이다 */
    @Column(name = "ticket_id", updatable = false)
    private Long ticketId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    /** 카드를 받은 지갑. <b>발행을 보내기 전에 반드시 채워져 있어야 한다</b> — 받는 주소가 여기서 나온다 */
    @Column(name = "wallet_id")
    private Long walletId;

    /*
     * ── 아래 일곱 개는 블록체인 서비스가 쓴다 (blockchain/DESIGN.md 1장 예외) ──────
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

    /** {@code design.chain_token_id} 와 같은 값이다. 포카의 tokenId 는 카드가 아니라 도안이다 */
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

    @Column(name = "mint_failure_code", length = 100, updatable = false)
    private String mintFailureCode;

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
        this.issueKey = NftChainIdentity.newIssueKey();
        this.status = NftMintStatus.PENDING;
    }

    public static NftPhotocard issue(NftPhotocardDesign design, Long ticketId, User owner) {
        return new NftPhotocard(design, ticketId, owner);
    }

    private NftPhotocard(NftPhotocardDesign design, User owner, Long walletId) {
        this.design = design;
        this.ticketId = null;
        this.owner = owner;
        this.walletId = walletId;
        this.issueKey = NftChainIdentity.newIssueKey();
        this.status = NftMintStatus.PENDING;
    }

    /**
     * 뽑기로 나온 카드. 티켓이 없고 지갑을 여기서 채운다 — 공연 발급은 배치 INSERT 가 wallet_id 를
     * 넣지만 뽑기는 한 장씩 JPA 로 저장하기 때문이다. 받는 주소가 이 값에서 나오므로 null 이면 안 된다.
     */
    public static NftPhotocard draw(NftPhotocardDesign design, User owner, Long walletId) {
        return new NftPhotocard(design, owner, walletId);
    }

    /** 온체인 이전이 확정된 뒤 DB 투영을 갱신한다. */
    public void transferTo(User buyer, Long buyerWalletId) {
        this.owner = buyer;
        this.walletId = buyerWalletId;
    }

    public boolean isOwnedBy(Long userId) {
        return owner.getId().equals(userId);
    }

    public boolean isMinted() {
        return status == NftMintStatus.MINTED;
    }
}
