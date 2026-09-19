package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardTrade;
import com.teacat.server.nft.entity.NftTradeChainStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record NftTradeStatusResponse(
        Long tradeId,
        Long photocardId,
        Long price,
        NftTradeChainStatus status,
        @Schema(description = "정산 완료 시각. 처리 중이면 null")
        LocalDateTime completedAt,
        @Schema(description = "실패 또는 운영 확인이 필요한 경우의 내부 분류")
        String failureCode
) {
    public static NftTradeStatusResponse from(NftPhotocardTrade trade) {
        return new NftTradeStatusResponse(trade.getId(), trade.getPhotocard().getId(), trade.getPrice(),
                publicStatus(trade), trade.getCompletedAt(), publicFailureCode(trade));
    }

    /**
     * 이상거래 심사 보류(RISK_REVIEW)는 사용자에게 "정산 대기" 로만 보인다. 심사 사실과 사유를 노출하면
     * 규칙을 역설계할 수 있다 (AUCTION_FRAUD_DESIGN.md 6-4). 거절도 사유 없이 실패로만 보인다.
     */
    static NftTradeChainStatus publicStatus(NftPhotocardTrade trade) {
        return trade.getChainStatus() == NftTradeChainStatus.RISK_REVIEW
                ? NftTradeChainStatus.PENDING : trade.getChainStatus();
    }

    static String publicFailureCode(NftPhotocardTrade trade) {
        return NftPhotocardTrade.RISK_REJECTED.equals(trade.getFailureCode()) ? null : trade.getFailureCode();
    }
}
