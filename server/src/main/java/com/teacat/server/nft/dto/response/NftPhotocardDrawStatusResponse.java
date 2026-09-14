package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/** 내 포토카드의 카드팩 칸(×n)과 뽑기 화면의 "다시 뽑기" 버튼이 이 값을 본다 */
public record NftPhotocardDrawStatusResponse(
        @Schema(description = "지금 뽑을 수 있는가 (remaining > 0)") boolean available,
        @Schema(description = "지금 열 수 있는 카드팩 수", example = "1") long remaining,
        @Schema(description = "아직 안 열린 카드팩 수. 결제 직후부터 여기에 잡힌다", example = "1") long scheduled,
        @Schema(description = "가장 빨리 열리는 시각. 잠긴 팩이 없으면 null") LocalDateTime nextOpenAt
) {
}
