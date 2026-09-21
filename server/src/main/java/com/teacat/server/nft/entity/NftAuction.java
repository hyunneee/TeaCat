package com.teacat.server.nft.entity;

import com.teacat.server.auth.security.ClientRequest;
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

import java.time.LocalDateTime;

/**
 * 공개 오름 입찰 경매.
 *
 * 상태 전이는 ACTIVE → SETTLING → SOLD 또는 ACTIVE → EXPIRED | CANCELLED 다. 시간 판정은 여기서 하지 않는다 —
 * 서비스가 DB 시계로 판정한다. 이 클래스는 상태와 불변식만 지킨다.
 */
@Entity
@Table(name = "nft_auctions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftAuction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "photocard_id", nullable = false, updatable = false)
    private NftPhotocard photocard;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seller_id", nullable = false, updatable = false)
    private User seller;

    @Column(name = "start_price", nullable = false, updatable = false)
    private Long startPrice;

    @Column(name = "buy_now_price", updatable = false)
    private Long buyNowPrice;

    /** 시작가로 시작해 최고 입찰가를 따라간다. SOLD 가 되면 체결가 */
    @Column(name = "current_price", nullable = false)
    private Long currentPrice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "top_bid_id")
    private NftAuctionBid topBid;

    @Column(name = "bid_count", nullable = false)
    private int bidCount;

    @Column(name = "ends_at", nullable = false, updatable = false)
    private LocalDateTime endsAt;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "nft_auction_status")
    private NftAuctionStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "winner_id")
    private User winner;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    /** 등록 요청을 보낸 판매자 단말. 이상거래 심사(판매자·구매자 동일 단말)가 읽는다. 모르면 null */
    @Column(name = "client_ip", length = 45, updatable = false)
    private String clientIp;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_agent_hash", length = 64, updatable = false)
    private String userAgentHash;

    private NftAuction(NftPhotocard photocard, User seller, Long startPrice, Long buyNowPrice, LocalDateTime endsAt) {
        this.photocard = photocard;
        this.seller = seller;
        this.startPrice = startPrice;
        this.buyNowPrice = buyNowPrice;
        this.currentPrice = startPrice;
        this.endsAt = endsAt;
        this.status = NftAuctionStatus.ACTIVE;
    }

    public static NftAuction create(NftPhotocard photocard, User seller, Long startPrice, Long buyNowPrice,
                                    LocalDateTime endsAt) {
        return new NftAuction(photocard, seller, startPrice, buyNowPrice, endsAt);
    }

    /** 새 최고 입찰을 반영한다. 유효성(금액·시간·자격) 검사는 서비스가 끝낸 뒤 부른다 */
    public void acceptBid(NftAuctionBid bid) {
        this.topBid = bid;
        this.currentPrice = bid.getAmount();
        this.bidCount++;
    }

    /** 체결. 낙찰이면 price = 최고 입찰가, 즉시구매면 price = 즉시구매가 */
    public void soldTo(User winner, Long price, LocalDateTime now) {
        this.status = NftAuctionStatus.SOLD;
        this.winner = winner;
        this.currentPrice = price;
        this.closedAt = now;
    }

    public void startSettlement(User winner, Long price, LocalDateTime now) {
        this.status = NftAuctionStatus.SETTLING;
        this.winner = winner;
        this.currentPrice = price;
        this.closedAt = now;
    }

    public void reopen() {
        this.status = NftAuctionStatus.ACTIVE;
        this.winner = null;
        this.currentPrice = topBid == null ? startPrice : topBid.getAmount();
        this.closedAt = null;
    }

    /** 등록 요청을 보낸 단말을 남긴다. 생성 직후 한 번만 부른다 */
    public void recordClientRequest(ClientRequest client) {
        if (client == null) {
            return;
        }
        this.clientIp = client.ip();
        this.userAgentHash = client.userAgentHash();
    }

    /** 유찰 */
    public void expire(LocalDateTime now) {
        this.status = NftAuctionStatus.EXPIRED;
        this.closedAt = now;
    }

    /**
     * 정산 시작(SETTLING) 뒤 이상거래 심사에서 거절돼 낙찰을 무효로 한다. 입찰 홀드는 풀리므로 유찰과 같은 끝이다.
     * {@link #expire} 와 달리 winner 를 지운다 — DB 제약 {@code chk_nft_auctions_winner} 는
     * SOLD·SETTLING 이 아닌 상태에 winner 가 남는 것을 허용하지 않는다.
     */
    public void voidSettlement(LocalDateTime now) {
        this.status = NftAuctionStatus.EXPIRED;
        this.winner = null;
        this.currentPrice = topBid == null ? startPrice : topBid.getAmount();
        this.closedAt = now;
    }

    public void cancel(LocalDateTime now) {
        this.status = NftAuctionStatus.CANCELLED;
        this.closedAt = now;
    }

    public boolean isActive() {
        return status == NftAuctionStatus.ACTIVE;
    }

    public boolean isSeller(Long userId) {
        return seller.getId().equals(userId);
    }

    public boolean isTopBidder(Long userId) {
        return topBid != null && topBid.isBy(userId);
    }

    public boolean hasBids() {
        return topBid != null;
    }

    public boolean hasBuyNow() {
        return buyNowPrice != null;
    }
}
