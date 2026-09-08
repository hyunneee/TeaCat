package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record NftAuctionBidHistoryResponse(
        @Schema(description = "입찰 ID", example = "77") Long bidId,
        @Schema(description = "입찰자 닉네임") String bidderNickname,
        @Schema(description = "입찰가(CAT)", example = "1800") Long amount,
        @Schema(description = "입찰 시각") LocalDateTime bidAt
) {
}
