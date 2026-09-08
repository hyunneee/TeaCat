package com.teacat.server.performance.dto.response;

import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.entity.PerformanceStatus;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 공연 상태 전환 응답 (API-264).
 */
@Schema(description = "공연 상태")
public record ConcertStatusResponse(

        @Schema(description = "공연 ID", example = "1")
        Long concertId,

        @Schema(description = "전환 전 상태", example = "UPCOMING")
        PerformanceStatus previousStatus,

        @Schema(description = "전환 후 상태", example = "ONGOING")
        PerformanceStatus status
) {

    public static ConcertStatusResponse of(PerformanceGeneral performance, PerformanceStatus previousStatus) {
        return new ConcertStatusResponse(performance.getId(), previousStatus, performance.getStatus());
    }
}
