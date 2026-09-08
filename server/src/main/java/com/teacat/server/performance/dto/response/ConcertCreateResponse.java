package com.teacat.server.performance.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 공연 등록 응답 (API-261).
 */
@Schema(description = "공연 등록 응답")
public record ConcertCreateResponse(

        @Schema(description = "생성된 공연 ID", example = "1")
        Long concertId,

        @Schema(description = "함께 생성된 회차 수", example = "2")
        int scheduleCount
) {

    public static ConcertCreateResponse of(Long concertId, int scheduleCount) {
        return new ConcertCreateResponse(concertId, scheduleCount);
    }
}
