package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftAuction;
import com.teacat.server.nft.entity.NftAuctionStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record NftAuctionResponse(

        @Schema(description = "경매 ID", example = "12")
        Long auctionId,

        @Schema(description = "포토카드 ID", example = "501")
        Long photocardId,

        @Schema(description = "경매 상태", example = "ACTIVE")
        NftAuctionStatus status,

        @Schema(description = "시작가(CAT)", example = "1000")
        Long startPrice,

        @Schema(description = "즉시구매가(CAT). 없으면 생략")
        Long buyNowPrice,

        @Schema(description = "현재가(CAT). 입찰 전에는 시작가", example = "1000")
        Long currentPrice,

        @Schema(description = "마감 시각")
        LocalDateTime endsAt,

        @Schema(description = "등록 시각")
        LocalDateTime createdAt
) {

    public static NftAuctionResponse from(NftAuction auction) {
        return new NftAuctionResponse(
                auction.getId(),
                auction.getPhotocard().getId(),
                auction.getStatus(),
                auction.getStartPrice(),
                auction.getBuyNowPrice(),
                auction.getCurrentPrice(),
                auction.getEndsAt(),
                auction.getCreatedAt()
        );
    }
}
