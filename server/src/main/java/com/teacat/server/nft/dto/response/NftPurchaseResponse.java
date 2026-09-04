package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardTrade;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record NftPurchaseResponse(

        @Schema(description = "거래 ID", example = "900")
        Long tradeId,

        @Schema(description = "포토카드 ID", example = "501")
        Long photocardId,

        @Schema(description = "체결가(CAT)", example = "3000")
        Long price,

        @Schema(description = "체결 시각")
        LocalDateTime tradedAt
) {

    public static NftPurchaseResponse from(NftPhotocardTrade trade) {
        return new NftPurchaseResponse(
                trade.getId(),
                trade.getPhotocard().getId(),
                trade.getPrice(),
                trade.getTradedAt()
        );
    }
}

