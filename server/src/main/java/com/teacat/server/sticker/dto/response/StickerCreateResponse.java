package com.teacat.server.sticker.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "스티커 생성 접수 결과")
public record StickerCreateResponse(

        @Schema(description = "작업 id. 이 번호로 상태를 물어봅니다", example = "41")
        Long jobId,

        @Schema(description = "오늘 더 만들 수 있는 장수", example = "4")
        int remainingToday
) {
}
