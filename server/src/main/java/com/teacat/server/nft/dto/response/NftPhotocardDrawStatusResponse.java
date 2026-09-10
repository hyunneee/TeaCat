package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/** 내 포토카드의 카드팩 칸(×n)과 뽑기 화면의 "다시 뽑기" 버튼이 이 값만 본다 */
public record NftPhotocardDrawStatusResponse(
        @Schema(description = "뽑을 수 있는가 (remaining > 0)") boolean available,
        @Schema(description = "안 쓴 카드팩 수", example = "3") long remaining
) {
}
