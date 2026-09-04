package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record NftSaleHistoryResponse(
        @Schema(description = "거래 ID") Long tradeId,
        @Schema(description = "포토카드 ID") Long photocardId,
        @Schema(description = "도안명") String designName,
        @Schema(description = "이미지 URL") String imageUrl,
        @Schema(description = "구매자 닉네임") String buyerNickname,
        @Schema(description = "체결가(CAT)") Long price,
        @Schema(description = "체결 시각") LocalDateTime tradedAt
) {
}

