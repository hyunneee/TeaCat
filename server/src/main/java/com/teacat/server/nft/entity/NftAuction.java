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

import java.time.LocalDateTime;

/**
 * 공개 오름 입찰 경매.
 *
 * 상태 전이는 ACTIVE → SOLD | EXPIRED | CANCELLED 한 번뿐이다. 시간 판정(마감 여부)은 여기서 하지 않는다 —
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

    /** 유찰 */
    public void expire(LocalDateTime now) {
        this.status = NftAuctionStatus.EXPIRED;
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
