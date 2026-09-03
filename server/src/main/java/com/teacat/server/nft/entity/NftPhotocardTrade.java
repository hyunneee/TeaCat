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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "listing_id", nullable = false, updatable = false)
    private NftPhotocardListing listing;

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

    private NftPhotocardTrade(NftPhotocardListing listing, User buyer, UUID idempotencyKey) {
        this.listing = listing;
        this.photocard = listing.getPhotocard();
        this.seller = listing.getSeller();
        this.buyer = buyer;
        this.price = listing.getPrice();
        this.idempotencyKey = idempotencyKey;
    }

    public static NftPhotocardTrade complete(NftPhotocardListing listing, User buyer, UUID idempotencyKey) {
        return new NftPhotocardTrade(listing, buyer, idempotencyKey);
    }
}
