package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record NftPhotocardTradeHistoryResponse(
        @Schema(description = "거래 ID") Long tradeId,
        @Schema(description = "체결가(CAT)") Long price,
        @Schema(description = "판매자 닉네임") String sellerNickname,
        @Schema(description = "구매자 닉네임") String buyerNickname,
        @Schema(description = "체결 시각") LocalDateTime tradedAt
) {
}

