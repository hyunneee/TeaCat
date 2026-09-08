package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record NftBidRequest(

        @Schema(description = "입찰가(CAT). 현재가보다 높고 즉시구매가보다 낮아야 한다", example = "1500", minimum = "1")
        @NotNull(message = "입찰가를 입력해 주세요.")
        @Positive(message = "입찰가를 1 이상으로 입력해 주세요.")
        Long amount
) {
}
