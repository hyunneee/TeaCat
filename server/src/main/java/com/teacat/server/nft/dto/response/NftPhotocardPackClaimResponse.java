package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record NftPhotocardPackClaimResponse(
        @Schema(description = "이번 요청으로 팩을 받았는가. 이미 받았거나 이벤트가 없으면 false") boolean granted,
        @Schema(description = "안 쓴 카드팩 수", example = "1") long remaining
) {
}
