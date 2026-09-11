package com.teacat.server.stadium.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "공연장 좌석표 이미지 정보")
public record StadiumLayoutImageResponse(
        @Schema(description = "공연장 ID", example = "1") Long stadiumId,
        @Schema(description = "좌석표 이미지 임시 조회 URL") String layoutImageUrl,
        @Schema(description = "원본 이미지 너비", example = "1920") int layoutWidth,
        @Schema(description = "원본 이미지 높이", example = "1080") int layoutHeight
) {
}
