package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Map;

/** 관리자 대시보드 카드용 심사 통계 */
public record NftTradeReviewStatsResponse(

        @Schema(description = "집계 기간(일)", example = "30")
        int windowDays,

        @Schema(description = "기간 안 성립한 거래 수 (경로 셋 합계)", example = "240")
        long trades,

        @Schema(description = "기간 안 열린 심사 수", example = "18")
        long reviews,

        @Schema(description = "지금 결정 대기 중인 심사 수 (기간 무관)", example = "2")
        long open,

        @Schema(description = "관리자 승인", example = "9")
        long approved,

        @Schema(description = "관리자 거절", example = "5")
        long rejected,

        @Schema(description = "시한 경과 자동 승인", example = "2")
        long autoApproved,

        @Schema(description = "규칙별 적중 수. 한 심사에 여러 규칙이 걸릴 수 있어 합이 reviews 보다 클 수 있다",
                example = "{\"R1_SAME_DEVICE\": 11, \"R4_PRICE_OUTLIER\": 6}")
        Map<String, Long> ruleHits
) {
}
