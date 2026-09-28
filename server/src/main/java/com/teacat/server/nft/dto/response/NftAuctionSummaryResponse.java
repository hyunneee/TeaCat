package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.repository.NftAuctionQueryRepository;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.Map;

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
        @Schema(description = "낙찰자 닉네임. 체결 전이면 생략") String winnerNickname,

        /* 🔴 마켓 목록(`NftMarketPhotocardResponse`)과 **같은 이유로** 있다 — 사는 사람이
           그 꾸밈을 그대로 받으므로 입찰 전에 보여줘야 한다. 둘은 한 쌍이라 한쪽만
           채우면 "고정가에는 보이는데 경매에는 안 보이는" 상태가 된다 (2026-09-23). */
        @Schema(description = "꾸민 카드 이미지 URL. 꾸미지 않았으면 null 입니다")
        String decoratedImageUrl
) {

    public static NftAuctionSummaryResponse from(NftAuctionQueryRepository.AuctionRow row) {
        return from(row, Map.of());
    }

    public static NftAuctionSummaryResponse from(
            NftAuctionQueryRepository.AuctionRow row, Map<Long, String> decoratedByPhotocardId) {
        return new NftAuctionSummaryResponse(row.auctionId(), row.photocardId(), row.designName(), row.imageUrl(),
                row.performanceTitle(), row.sellerNickname(), row.startPrice(), row.currentPrice(), row.buyNowPrice(),
                row.bidCount(), row.endsAt(), row.status(), row.closedAt(), row.winnerNickname(),
                decoratedByPhotocardId.get(row.photocardId()));
    }
}
