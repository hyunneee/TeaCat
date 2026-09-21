package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftReviewDecision;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeChainStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.List;

/** 관리자 거래 내역 페이지 — 경로·상태 무관 전체 거래. 심사가 붙은 거래는 심사 정보를 함께 준다 */
@Schema(description = "관리자 거래 내역 페이지")
public record NftAdminTradePageResponse(

        List<Trade> trades,

        @Schema(description = "현재 페이지 (0부터)", example = "0")
        int page,

        @Schema(description = "페이지 크기", example = "20")
        int size,

        @Schema(description = "전체 개수", example = "240")
        long totalElements,

        @Schema(description = "전체 페이지 수", example = "12")
        int totalPages
) {

    public record Trade(
            @Schema(description = "거래 ID") Long tradeId,
            @Schema(description = "거래 경로", example = "AUCTION") NftTradeReviewSummaryResponse.TradeSource source,
            Long auctionId,
            Long listingId,
            Long photocardId,
            String designName,
            String imageUrl,
            Long sellerId,
            String sellerNickname,
            Long buyerId,
            String buyerNickname,
            @Schema(description = "거래가(CAT)") Long price,
            @Schema(description = "체인 정산 상태. 관리자에게는 RISK_REVIEW 도 그대로 보인다") NftTradeChainStatus chainStatus,
            @Schema(description = "실패·보류 사유 코드. 관리자에게는 RISK_REJECTED 도 그대로 보인다") String failureCode,
            LocalDateTime createdAt,
            @Schema(description = "정산 완료(또는 보상 완료) 시각") LocalDateTime completedAt,
            @Schema(description = "심사 ID. 심사에 걸린 적이 없으면 null") Long reviewId,
            @Schema(description = "심사 결정. 대기 중이거나 심사 없으면 null") NftReviewDecision reviewDecision,
            @Schema(description = "심사 최고 무게. 심사 없으면 null") NftReviewSeverity reviewSeverity,
            @Schema(description = "심사가 정산을 실제로 멈췄나. 심사 없으면 null") Boolean reviewHeld
    ) {
    }

    public static NftAdminTradePageResponse of(List<Trade> trades, int page, int size, long total) {
        int totalPages = size <= 0 ? 0 : (int) Math.ceil((double) total / size);
        return new NftAdminTradePageResponse(trades, page, size, total, totalPages);
    }
}
