package com.teacat.server.performance.dto.response;

import com.teacat.server.performance.entity.PerformanceGeneral;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 공연 공개 · 비공개 전환 응답 (API-271).
 */
@Schema(description = "공연 노출 상태")
public record ConcertVisibilityResponse(

        @Schema(description = "공연 ID", example = "1")
        Long concertId,

        @Schema(description = "현재 공개 여부", example = "false")
        boolean visible,

        @Schema(description = "비공개로 바뀐 시각. 공개 상태면 null")
        LocalDateTime hiddenAt
) {

    public static ConcertVisibilityResponse from(PerformanceGeneral performance) {
        return new ConcertVisibilityResponse(
                performance.getId(),
                !performance.isHidden(),
                performance.getDeletedAt()
        );
    }
}
