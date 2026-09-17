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
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "nft_photocard_listings")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocardListing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "photocard_id", nullable = false)
    private NftPhotocard photocard;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seller_id", nullable = false)
    private User seller;

    @Column(name = "price", nullable = false)
    private Long price;

    @Column(name = "description", nullable = false, length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "nft_photocard_listing_status")
    private NftListingStatus status;

    @CreationTimestamp
    @Column(name = "listed_at", nullable = false, updatable = false)
    private LocalDateTime listedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    private NftPhotocardListing(NftPhotocard photocard, User seller, Long price, String description) {
        this.photocard = photocard;
        this.seller = seller;
        this.price = price;
        this.description = description;
        this.status = NftListingStatus.ACTIVE;
    }

    public static NftPhotocardListing create(NftPhotocard photocard, User seller, Long price, String description) {
        return new NftPhotocardListing(photocard, seller, price, description);
    }

    public void cancel(LocalDateTime now) {
        this.status = NftListingStatus.CANCELLED;
        this.closedAt = now;
    }

    public void sold(LocalDateTime now) {
        this.status = NftListingStatus.SOLD;
        this.closedAt = now;
    }

    public void startSettlement() {
        this.status = NftListingStatus.SETTLING;
    }

    public void reopen() {
        this.status = NftListingStatus.ACTIVE;
        this.closedAt = null;
    }

    public boolean isActive() {
        return status == NftListingStatus.ACTIVE;
    }

    public boolean isOwnedBy(Long userId) {
        return seller.getId().equals(userId);
    }
}
