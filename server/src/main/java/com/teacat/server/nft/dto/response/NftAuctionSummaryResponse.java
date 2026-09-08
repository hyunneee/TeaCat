package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/** 경매 목록 항목. 마켓 목록과 내 경매 목록이 같이 쓴다 (내 경매에서만 status·closedAt·winnerNickname 이 의미 있다) */
public record NftAuctionSummaryResponse(
        @Schema(description = "경매 ID", example = "12") Long auctionId,
        @Schema(description = "포토카드 ID", example = "501") Long photocardId,
        @Schema(description = "도안명") String designName,
        @Schema(description = "이미지 URL") String imageUrl,
        @Schema(description = "공연명") String performanceTitle,
        @Schema(description = "판매자 닉네임") String sellerNickname,
        @Schema(description = "시작가(CAT)", example = "1000") Long startPrice,
        @Schema(description = "현재가(CAT)", example = "1800") Long currentPrice,
        @Schema(description = "즉시구매가(CAT). 없으면 생략") Long buyNowPrice,
        @Schema(description = "입찰 수", example = "4") int bidCount,
        @Schema(description = "마감 시각") LocalDateTime endsAt,
        @Schema(description = "경매 상태", example = "ACTIVE") NftAuctionStatus status,
        @Schema(description = "종료 시각. 진행 중이면 생략") LocalDateTime closedAt,
        @Schema(description = "낙찰자 닉네임. 체결 전이면 생략") String winnerNickname
) {

    public static NftAuctionSummaryResponse from(NftAuctionQueryRepository.AuctionRow row) {
        return new NftAuctionSummaryResponse(row.auctionId(), row.photocardId(), row.designName(), row.imageUrl(),
                row.performanceTitle(), row.sellerNickname(), row.startPrice(), row.currentPrice(), row.buyNowPrice(),
                row.bidCount(), row.endsAt(), row.status(), row.closedAt(), row.winnerNickname());
    }
}
