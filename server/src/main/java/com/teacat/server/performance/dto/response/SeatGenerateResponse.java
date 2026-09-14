package com.teacat.server.performance.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 회차 좌석 생성 응답 (API-269).
 */
@Schema(description = "회차 좌석 생성 응답")
public record SeatGenerateResponse(

        @Schema(description = "회차 ID", example = "1")
        Long scheduleId,

        @Schema(description = "생성한 좌석 수", example = "1200")
        int createdSeatCount,

        @Schema(description = "좌석 재고를 만든 구역 수. 스탠딩 가상 좌석 구역도 포함한다", example = "4")
        int seatedAreaCount
) {

    public static SeatGenerateResponse of(Long scheduleId, int createdSeatCount, int seatedAreaCount) {
        return new SeatGenerateResponse(scheduleId, createdSeatCount, seatedAreaCount);
    }
}
