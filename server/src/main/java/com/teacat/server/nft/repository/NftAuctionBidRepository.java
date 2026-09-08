package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftAuctionBid;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface NftAuctionBidRepository extends JpaRepository<NftAuctionBid, Long> {

    /** 이 유저가 이 경매에 넣은 가장 높은 금액. 입찰이 없으면 empty */
    @Query("""
            select max(b.amount)
              from NftAuctionBid b
             where b.auction.id = :auctionId
               and b.bidder.id = :bidderId
            """)
    Optional<Long> findMyHighestBid(@Param("auctionId") Long auctionId, @Param("bidderId") Long bidderId);
}
