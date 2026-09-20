package com.teacat.server.sticker.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 워커가 집어간 일감.
 *
 * <p>🔴 <b>노트북의 계약이다.</b> 필드 이름을 바꾸면 노트북도 고쳐야 한다
 * ({@code ai-sticker-lab/sticker_worker_qwen.py}).
 */
@Schema(description = "워커에게 내주는 일감")
public record StickerJobClaimResponse(

        @Schema(description = "작업 id", example = "41")
        Long jobId,

        @Schema(description = "낙서 PNG 의 base64 (접두어 없음)")
        String sketchBase64,

        @Schema(description = "사용자가 적은 주제. null 이면 워커가 캡셔너로 채웁니다", example = "고양이")
        String subject,

        @Schema(description = "생성 시드. 🔴 항상 채워 보냅니다 — null 이면 워커가 자기 기본값을 써서 "
                + "'다시 만들기' 가 같은 그림을 줍니다", example = "12345")
        Integer seed
) {
}
