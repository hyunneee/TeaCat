package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftReviewAnalysisStatus;
import com.teacat.server.nft.entity.NftReviewDecision;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeChainStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.List;

/** 관리자 심사 목록의 한 줄 */
public record NftTradeReviewSummaryResponse(

        @Schema(description = "심사 ID", example = "12")
        Long reviewId,

        @Schema(description = "거래 ID", example = "900")
        Long tradeId,

        @Schema(description = "거래 경로", example = "AUCTION")
        TradeSource source,

        @Schema(description = "경매 ID. 경매가 아니면 null", example = "45")
        Long auctionId,

        @Schema(description = "고정가 판매 ID. 고정가가 아니면 null")
        Long listingId,

        @Schema(description = "포토카드 ID", example = "501")
        Long photocardId,

        @Schema(description = "도안명", example = "한정 포토카드")
        String designName,

        @Schema(description = "도안 이미지")
        String imageUrl,

        @Schema(description = "거래가(CAT)", example = "8000")
        Long price,

        @Schema(description = "거래 체인 상태. 대기 중이면 RISK_REVIEW", example = "RISK_REVIEW")
        NftTradeChainStatus tradeStatus,

        @Schema(description = "걸린 신호 중 가장 무거운 것", example = "HIGH")
        NftReviewSeverity maxSeverity,

        @Schema(description = "보류 기준(HIGH 1개 또는 MEDIUM 2개)을 넘었나. 신호가 하나만 있어도 행은 남는다")
        boolean flagged,

        @Schema(description = "정산을 실제로 멈췄나(HOLD 모드). false 면 거래는 이미 정산됐고 결정은 판정 기록이다")
        boolean held,

        @Schema(description = "걸린 규칙 코드", example = "[\"R1_SAME_DEVICE\", \"R4_PRICE_OUTLIER\"]")
        List<String> rules,

        @Schema(description = "AI 분석 상태", example = "DONE")
        NftReviewAnalysisStatus analysisStatus,

        @Schema(description = "AI 분석 한 줄 요약. 없으면 null")
        String headline,

        @Schema(description = "심사 열린 시각")
        LocalDateTime createdAt,

        @Schema(description = "이 시각까지 결정이 없으면 자동 승인. 결정이 났으면 null")
        LocalDateTime autoApproveAt,

        @Schema(description = "결정. 대기 중이면 null")
        NftReviewDecision decision,

        @Schema(description = "결정 시각")
        LocalDateTime decidedAt,

        @Schema(description = "시한 경과 자동 승인이었나")
        boolean autoApproved,

        Party seller,

        Party buyer
) {

    public enum TradeSource { AUCTION, LISTING }

    /** 계정 요약. 관리자 화면이라 닉네임을 준다. 이메일·전화는 상세에만 */
    public record Party(
            @Schema(description = "회원 ID", example = "42") Long userId,
            @Schema(description = "닉네임") String nickname,
            @Schema(description = "최근 90일 심사에 등장한 횟수 (이 건 포함)", example = "3") long reviewAppearances90d
    ) {
    }
}
