package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftAuction;
import com.teacat.server.nft.entity.NftAuctionBid;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record NftBidResponse(

        @Schema(description = "입찰 ID", example = "77")
        Long bidId,

        @Schema(description = "경매 ID", example = "12")
        Long auctionId,

        @Schema(description = "내 입찰가(CAT)", example = "1500")
        Long amount,

        @Schema(description = "반영된 현재가(CAT)", example = "1500")
        Long currentPrice,

        @Schema(description = "누적 입찰 수", example = "5")
        int bidCount,

        @Schema(description = "마감 시각")
        LocalDateTime endsAt,

        @Schema(description = "이 입찰로 내가 최고 입찰자가 되었는지. 성공 응답에서는 항상 true", example = "true")
        boolean isTopBidder
) {

    public static NftBidResponse of(NftAuctionBid bid, NftAuction auction) {
        return new NftBidResponse(bid.getId(), auction.getId(), bid.getAmount(), auction.getCurrentPrice(),
                auction.getBidCount(), auction.getEndsAt(), true);
    }
}
