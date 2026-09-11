package com.teacat.server.stadium.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "좌석 일괄 생성 응답")
public record SeatBulkCreateResponse(
        @Schema(description = "구역 ID", example = "10") Long areaId,
        @Schema(description = "생성된 좌석 수", example = "2") int createdSeatCount,
        @Schema(description = "현재 전체 좌석 수", example = "102") long totalSeatCount
) {
}
