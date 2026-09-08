package com.teacat.server.stadium.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "공연장 목록 응답")
public record StadiumListResponse(
        @Schema(description = "공연장 목록") List<StadiumSummaryResponse> stadiums
) {
}
