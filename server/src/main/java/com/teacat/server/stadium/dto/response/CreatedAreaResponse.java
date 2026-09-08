package com.teacat.server.stadium.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "생성된 구역 요약")
public record CreatedAreaResponse(
        @Schema(description = "구역 ID", example = "10") Long areaId,
        @Schema(description = "구역 코드", example = "A") String areaCode,
        @Schema(description = "함께 생성된 좌석 수", example = "100") int createdSeatCount
) {
}
