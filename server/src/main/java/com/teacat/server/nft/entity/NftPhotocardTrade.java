package com.teacat.server.nft.entity;

import com.teacat.server.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "nft_photocard_trades")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocardTrade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 고정가 거래의 출처. 경매 거래면 null */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "listing_id", updatable = false)
    private NftPhotocardListing listing;

    /** 경매 거래의 출처. 고정가 거래면 null. DB CHECK 가 둘 중 정확히 하나만 허용한다 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auction_id", updatable = false)
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

    @CreationTimestamp
    @Column(name = "traded_at", nullable = false, updatable = false)
    private LocalDateTime tradedAt;

    private NftPhotocardTrade(NftPhotocardListing listing, NftAuction auction, NftPhotocard photocard,
                              User seller, User buyer, Long price, UUID idempotencyKey) {
        this.listing = listing;
        this.auction = auction;
        this.photocard = photocard;
        this.seller = seller;
        this.buyer = buyer;
        this.price = price;
        this.idempotencyKey = idempotencyKey;
    }

    /** 고정가 구매 체결 */
    public static NftPhotocardTrade complete(NftPhotocardListing listing, User buyer, UUID idempotencyKey) {
        return new NftPhotocardTrade(listing, null, listing.getPhotocard(), listing.getSeller(), buyer,
                listing.getPrice(), idempotencyKey);
    }

    /** 경매 체결 (낙찰 또는 즉시구매). price 는 체결가 */
    public static NftPhotocardTrade fromAuction(NftAuction auction, User buyer, Long price, UUID idempotencyKey) {
        return new NftPhotocardTrade(null, auction, auction.getPhotocard(), auction.getSeller(), buyer,
                price, idempotencyKey);
    }
}
