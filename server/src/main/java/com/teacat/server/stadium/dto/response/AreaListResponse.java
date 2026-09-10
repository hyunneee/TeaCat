package com.teacat.server.stadium.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "공연장 구역 목록 응답")
public record AreaListResponse(
        @Schema(description = "공연장 ID", example = "1") Long stadiumId,
        @Schema(description = "구역 목록") List<AreaSummaryResponse> areas
) {
}
