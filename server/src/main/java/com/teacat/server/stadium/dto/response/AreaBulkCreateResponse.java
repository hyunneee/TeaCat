package com.teacat.server.stadium.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "구역과 초기 좌석 일괄 생성 응답")
public record AreaBulkCreateResponse(
        @Schema(description = "생성된 구역 수", example = "2") int createdAreaCount,
        @Schema(description = "생성된 좌석 수", example = "102") int createdSeatCount,
        @Schema(description = "생성된 구역 목록") List<CreatedAreaResponse> areas
) {
}
