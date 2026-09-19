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

    /** 등록 요청을 보낸 판매자 단말. 이상거래 심사(판매자·구매자 동일 단말)가 읽는다. 모르면 null */
    @Column(name = "client_ip", length = 45, updatable = false)
    private String clientIp;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_agent_hash", length = 64, updatable = false)
    private String userAgentHash;

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

    /** 등록 요청을 보낸 단말을 남긴다. 생성 직후 한 번만 부른다 */
    public void recordClientRequest(ClientRequest client) {
        if (client == null) {
            return;
        }
        this.clientIp = client.ip();
        this.userAgentHash = client.userAgentHash();
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
