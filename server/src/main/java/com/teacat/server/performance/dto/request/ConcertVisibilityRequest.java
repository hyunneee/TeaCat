package com.teacat.server.performance.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * 공연 공개 · 비공개 전환 요청 (API-271).
 */
@Schema(description = "공연 노출 전환 요청")
public record ConcertVisibilityRequest(

        @Schema(description = "true 면 공개, false 면 비공개", example = "false")
        @NotNull(message = "공개 여부를 지정해 주세요.")
        Boolean visible
) {
}
