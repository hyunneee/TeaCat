package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardTrade;
import com.teacat.server.nft.entity.NftTradeChainStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record NftPurchaseResponse(

        @Schema(description = "거래 ID", example = "900")
        Long tradeId,

        @Schema(description = "포토카드 ID", example = "501")
        Long photocardId,

        @Schema(description = "체결가(CAT)", example = "3000")
        Long price,

        @Schema(description = "체결 시각. 정산 중이면 null")
        LocalDateTime tradedAt,

        @Schema(description = "온체인 정산 상태", example = "PENDING")
        NftTradeChainStatus status
) {

    public static NftPurchaseResponse from(NftPhotocardTrade trade) {
        return new NftPurchaseResponse(
                trade.getId(),
                trade.getPhotocard().getId(),
                trade.getPrice(),
                trade.getCompletedAt(),
                trade.getChainStatus()
        );
    }
}
