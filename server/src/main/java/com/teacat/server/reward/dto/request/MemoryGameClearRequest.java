package com.teacat.server.reward.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 짝 맞추기 클리어 보고.
 *
 * <p>🔴 <b>걸린 시간 자리가 없다.</b> 서버가 시작 시각을 들고 있다가 뺀다 — 화면이 보낸 시간을
 * 믿으면 1등이 매일 조작된다 ({@code MemoryGameSession} 주석).
 */
@Schema(description = "짝 맞추기 클리어 보고")
public record MemoryGameClearRequest(
        @Schema(description = "뒤집은 횟수. 순위에는 쓰지 않고 기록으로만 남깁니다", example = "24")
        @Min(value = 1, message = "뒤집은 횟수가 올바르지 않습니다.")
        @Max(value = 9999, message = "뒤집은 횟수가 올바르지 않습니다.")
        int moves
) {
}
