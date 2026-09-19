package com.teacat.server.nft.entity;

import com.teacat.server.auth.security.ClientRequest;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 입찰 한 건. 한 번 들어오면 바뀌지 않는다 (철회 없음).
 * 담보는 cat_money_holds (AUCTION_BID, 이 id) 에 있다.
 */
@Entity
@Table(name = "nft_auction_bids")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftAuctionBid {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "auction_id", nullable = false, updatable = false)
    private NftAuction auction;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bidder_id", nullable = false, updatable = false)
    private User bidder;

    @Column(name = "amount", nullable = false, updatable = false)
    private Long amount;

    /** 입찰 요청을 보낸 단말. 이상거래 심사(판매자·입찰자 동일 단말)가 읽는다. 모르면 null */
    @Column(name = "client_ip", length = 45, updatable = false)
    private String clientIp;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_agent_hash", length = 64, updatable = false)
    private String userAgentHash;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private NftAuctionBid(NftAuction auction, User bidder, Long amount) {
        this.auction = auction;
        this.bidder = bidder;
        this.amount = amount;
    }

    public static NftAuctionBid place(NftAuction auction, User bidder, Long amount) {
        return new NftAuctionBid(auction, bidder, amount);
    }

    public static NftAuctionBid place(NftAuction auction, User bidder, Long amount, ClientRequest client) {
        NftAuctionBid bid = new NftAuctionBid(auction, bidder, amount);
        if (client != null) {
            bid.clientIp = client.ip();
            bid.userAgentHash = client.userAgentHash();
        }
        return bid;
    }

    public boolean isBy(Long userId) {
        return bidder.getId().equals(userId);
    }
}
