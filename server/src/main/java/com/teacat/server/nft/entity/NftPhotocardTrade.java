package com.teacat.server.nft.entity;

import com.teacat.server.user.entity.User;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "nft_photocard_trades")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocardTrade {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "listing_id", updatable = false)
    private NftPhotocardListing listing;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "auction_id", updatable = false)
    private NftAuction auction;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "photocard_id", nullable = false, updatable = false)
    private NftPhotocard photocard;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seller_id", nullable = false, updatable = false)
    private User seller;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "buyer_id", nullable = false, updatable = false)
    private User buyer;
    @Column(name = "price", nullable = false, updatable = false)
    private Long price;
    @Column(name = "idempotency_key", nullable = false, updatable = false, columnDefinition = "uuid")
    private UUID idempotencyKey;

    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "chain_status", nullable = false, columnDefinition = "nft_trade_chain_status")
    private NftTradeChainStatus chainStatus;
    @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "payment_hold_ref_type", columnDefinition = "cat_money_hold_ref_type")
    private CatMoneyHoldRefType paymentHoldRefType;
    @Column(name = "payment_hold_ref_id") private Long paymentHoldRefId;
    @Column(name = "settle_operation_key", length = 200) private String settleOperationKey;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "settle_tx_hash", length = 66) private String settleTxHash;
    @Column(name = "transfer_operation_key", length = 200) private String transferOperationKey;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "transfer_tx_hash", length = 66) private String transferTxHash;
    @Column(name = "refund_operation_key", length = 200) private String refundOperationKey;
    @JdbcTypeCode(SqlTypes.CHAR) @Column(name = "refund_tx_hash", length = 66) private String refundTxHash;
    @Column(name = "failure_code", length = 100) private String failureCode;
    @Column(name = "retry_count", nullable = false) private int retryCount;
    @Column(name = "next_retry_at") private LocalDateTime nextRetryAt;
    @Column(name = "traded_at") private LocalDateTime tradedAt;
    @Column(name = "completed_at") private LocalDateTime completedAt;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private NftPhotocardTrade(NftPhotocardListing listing, NftAuction auction, NftPhotocard photocard,
                              User seller, User buyer, Long price, UUID idempotencyKey) {
        this.listing = listing;
        this.auction = auction;
        this.photocard = photocard;
        this.seller = seller;
        this.buyer = buyer;
        this.price = price;
        this.idempotencyKey = idempotencyKey;
        this.chainStatus = NftTradeChainStatus.PENDING;
    }

    public static NftPhotocardTrade pendingListing(NftPhotocardListing listing, User buyer, UUID key) {
        return new NftPhotocardTrade(listing, null, listing.getPhotocard(), listing.getSeller(), buyer,
                listing.getPrice(), key);
    }

    public static NftPhotocardTrade pendingAuction(NftAuction auction, User buyer, Long price, UUID key) {
        return new NftPhotocardTrade(null, auction, auction.getPhotocard(), auction.getSeller(), buyer, price, key);
    }

    public void initializeSettlement(CatMoneyHoldRefType holdRefType, Long holdRefId) {
        this.paymentHoldRefType = holdRefType;
        this.paymentHoldRefId = holdRefId;
        this.settleOperationKey = "nft-trade:%d:cat".formatted(id);
        this.transferOperationKey = "nft-trade:%d:photocard".formatted(id);
        this.refundOperationKey = "nft-trade:%d:refund".formatted(id);
    }

    public void catSubmitted(String txHash) { chainStatus = NftTradeChainStatus.CAT_SUBMITTED; settleTxHash = txHash; clearRetry(); }
    public void catConfirmed() { chainStatus = NftTradeChainStatus.CAT_CONFIRMED; clearRetry(); }
    public void nftSubmitted(String txHash) { chainStatus = NftTradeChainStatus.NFT_SUBMITTED; transferTxHash = txHash; clearRetry(); }
    public void startCompensation(String code) { chainStatus = NftTradeChainStatus.COMPENSATING; failureCode = code; clearRetry(); }
    public void refundSubmitted(String txHash) { chainStatus = NftTradeChainStatus.REFUND_SUBMITTED; refundTxHash = txHash; clearRetry(); }
    public void complete(LocalDateTime now) { chainStatus = NftTradeChainStatus.COMPLETED; completedAt = now; tradedAt = now; failureCode = null; clearRetry(); }
    public void compensated(LocalDateTime now) { chainStatus = NftTradeChainStatus.COMPENSATED; completedAt = now; clearRetry(); }
    public void fail(String code) { chainStatus = NftTradeChainStatus.FAILED; failureCode = code; clearRetry(); }
    public void manualReview(String code) { chainStatus = NftTradeChainStatus.MANUAL_REVIEW; failureCode = code; nextRetryAt = null; }
    public void retryLater(String code, LocalDateTime at) { failureCode = code; retryCount++; nextRetryAt = at; }
    public void retryCat(String code, LocalDateTime at) { chainStatus = NftTradeChainStatus.PENDING; settleTxHash = null; retryLater(code, at); }
    public void retryNft(String code, LocalDateTime at) { chainStatus = NftTradeChainStatus.CAT_CONFIRMED; transferTxHash = null; retryLater(code, at); }
    public void retryRefund(String code, LocalDateTime at) { chainStatus = NftTradeChainStatus.COMPENSATING; refundTxHash = null; retryLater(code, at); }

    private void clearRetry() { retryCount = 0; nextRetryAt = null; }
    public boolean isParticipant(Long userId) { return buyer.getId().equals(userId) || seller.getId().equals(userId); }
}
