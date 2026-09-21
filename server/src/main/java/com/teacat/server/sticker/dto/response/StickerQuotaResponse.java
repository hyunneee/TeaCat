package com.teacat.server.sticker.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/** 오늘 몫. 화면이 "오늘 N장 남음" 을 보여줄 때 쓴다 */
@Schema(description = "오늘 만들 수 있는 스티커")
public record StickerQuotaResponse(

        @Schema(description = "하루 상한", example = "5")
        int limit,

        @Schema(description = "오늘 쓴 장수. 실패한 작업은 세지 않습니다", example = "1")
        int used,

        @Schema(description = "남은 장수", example = "4")
        int remaining
) {

    public static StickerQuotaResponse of(int limit, long used) {
        int usedCount = (int) Math.min(used, Integer.MAX_VALUE);
        // 상한을 낮추면 음수가 될 수 있어 바닥을 깐다
        return new StickerQuotaResponse(limit, usedCount, Math.max(0, limit - usedCount));
    }
}
