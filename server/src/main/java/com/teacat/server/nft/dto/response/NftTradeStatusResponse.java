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
                trade.getChainStatus(), trade.getCompletedAt(), trade.getFailureCode());
    }
}
