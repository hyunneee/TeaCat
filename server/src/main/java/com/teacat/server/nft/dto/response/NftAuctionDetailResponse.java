package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftAuctionStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record NftAuctionDetailResponse(
        @Schema(description = "경매 ID", example = "12") Long auctionId,
        @Schema(description = "경매 상태", example = "ACTIVE") NftAuctionStatus status,
        @Schema(description = "포토카드 요약") Photocard photocard,
        @Schema(description = "판매자 닉네임") String sellerNickname,
        @Schema(description = "시작가(CAT)", example = "1000") Long startPrice,
        @Schema(description = "현재가(CAT). 종료 후에는 체결가", example = "1800") Long currentPrice,
        @Schema(description = "즉시구매가(CAT). 없으면 생략") Long buyNowPrice,
        @Schema(description = "입찰 수", example = "4") int bidCount,
        @Schema(description = "현재 최고 입찰자 닉네임. 입찰 전이면 생략") String topBidderNickname,
        @Schema(description = "등록 시각") LocalDateTime createdAt,
        @Schema(description = "마감 시각") LocalDateTime endsAt,
        @Schema(description = "종료 시각. 진행 중이면 생략") LocalDateTime closedAt,
        @Schema(description = "낙찰자 닉네임. 체결 전이면 생략") String winnerNickname,
        @Schema(description = "체결가(CAT). SOLD 가 아니면 생략") Long finalPrice,
        @Schema(description = "요청자 관점 정보. 비로그인이면 생략") Viewer viewer
) {

    public record Photocard(
            @Schema(description = "포토카드 ID", example = "501") Long photocardId,
            @Schema(description = "도안명") String designName,
            @Schema(description = "이미지 URL") String imageUrl,
            @Schema(description = "공연명") String performanceTitle,

            /* 🔴 목록(`NftAuctionSummaryResponse`)에만 넣고 여기를 빠뜨리면 **목록에는 꾸민
               모습이 보이는데 눌러 들어가면 맨 카드**가 됩니다. 목록·상세는 한 쌍입니다
               (고정가 쪽에서 실제로 그렇게 됐습니다 — 2026-09-23). */
            @Schema(description = "꾸민 카드 이미지 URL. 꾸미지 않았으면 null 입니다")
            String decoratedImageUrl
    ) {
    }

    public record Viewer(
            @Schema(description = "내가 판매자인지", example = "false") boolean isSeller,
            @Schema(description = "내가 현재 최고 입찰자인지", example = "true") boolean isTopBidder,
            @Schema(description = "내가 넣은 가장 높은 입찰가. 입찰 전이면 생략", example = "1800") Long myHighestBid
    ) {
    }
}
