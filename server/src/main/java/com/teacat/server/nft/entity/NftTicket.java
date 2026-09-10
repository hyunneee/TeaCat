package com.teacat.server.nft.entity;

import com.teacat.server.ticket.entity.Ticket;
import com.teacat.server.wallet.entity.Wallet;
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
import java.util.UUID;

/**
 * 티켓의 SBT(양도 불가 NFT).
 *
 * <p>발권된 티켓 한 장에 하나씩 생깁니다. 발행을 요청하기 <b>전에</b> 이 행을 먼저 커밋합니다 —
 * 그래야 그 사이에 서버가 죽어도 재시도 대상으로 남습니다.
 *
 * <p>🔴 <b>컬럼 소유권이 나뉘어 있습니다.</b> 확정 결과는 블록체인 서비스가 직접 UPDATE 하므로
 * {@code updatable = false} 입니다. 이걸 풀면 우리가 로드해 둔 엔티티가 flush 되면서 저쪽이 쓴
 * 결과를 <b>덮어씁니다.</b> (blockchain/DESIGN.md 1장 "예외 하나")
 *
 * <pre>
 *   저쪽이 쓴다 : status · token_id · contract_address · mint_tx_hash · burn_tx_hash · minted_at
 *   우리가 쓴다 : ticket_id · wallet_id · chain_id · ticket_key
 * </pre>
 */
@Entity
@Table(name = "nft_tickets")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false, updatable = false)
    private Ticket ticket;

    /** 받는 지갑. 티켓은 양도가 불가능해서 엉뚱한 주소로 나가면 옮길 방법이 없다 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wallet_id", nullable = false, updatable = false)
    private Wallet wallet;

    @Column(name = "chain_id", nullable = false, updatable = false)
    private Integer chainId;

    /**
     * 발행 멱등 키. 블록체인 서비스가 이 값을 그대로 keccak256 해서 온체인 tokenId 를 만든다.
     *
     * <p>PK(순번)를 쓰면 두 가지가 깨진다 — 개발 중 DB 를 밀면 같은 번호가 재사용되는데 공용
     * 체인은 못 밀어서 그 키가 영구히 막히고, 남의 키를 추측해 미리 태울 수도 있다.
     *
     * <p>🔴 온체인에 해시가 영구히 남으므로 비밀값을 넣으면 안 된다.
     */
    @Column(name = "ticket_key", nullable = false, updatable = false)
    private UUID ticketKey;

    // ── 여기부터는 블록체인 서비스가 쓴다. updatable = false 를 풀지 말 것 ──

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, updatable = false, insertable = false,
            columnDefinition = "nft_mint_status")
    private NftMintStatus status;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "contract_address", length = 42, updatable = false, insertable = false)
    private String contractAddress;

    @Column(name = "token_id", updatable = false, insertable = false)
    private BigInteger tokenId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "mint_tx_hash", length = 66, updatable = false, insertable = false)
    private String mintTxHash;

    /** 예매 취소로 소각한 트랜잭션 */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "burn_tx_hash", length = 66, updatable = false, insertable = false)
    private String burnTxHash;

    @Column(name = "minted_at", updatable = false, insertable = false)
    private LocalDateTime mintedAt;

    // ── 다시 우리 소유 ──────────────────────────────────────────

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private NftTicket(Ticket ticket, Wallet wallet, int chainId) {
        this.ticket = ticket;
        this.wallet = wallet;
        this.chainId = chainId;
        this.ticketKey = UUID.randomUUID();
    }

    /**
     * 발행 대상을 만든다. 상태는 DB 기본값 {@code PENDING} 으로 시작하고, 그 뒤로는
     * 블록체인 서비스가 소유한다.
     */
    public static NftTicket pending(Ticket ticket, Wallet wallet, int chainId) {
        return new NftTicket(ticket, wallet, chainId);
    }

    /** 체인에 실제로 올라갔는가. 입장 판정은 이게 true 여야 한다 */
    public boolean isMinted() {
        return status == NftMintStatus.MINTED;
    }

    /** 발행 요청이 나갔는가. 블록체인 서비스가 전송 직후 tx 해시를 남긴다 */
    public boolean isIssueSent() {
        return mintTxHash != null;
    }
}
