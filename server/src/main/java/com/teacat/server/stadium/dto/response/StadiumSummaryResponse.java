package com.teacat.server.stadium.dto.response;

import com.teacat.server.stadium.entity.Stadium;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 공연장 목록 항목 (API-251).
 */
@Schema(description = "공연장 요약")
public record StadiumSummaryResponse(

        @Schema(description = "공연장 ID", example = "1")
        Long stadiumId,

        @Schema(description = "이름", example = "올림픽홀")
        String name,

        @Schema(description = "주소", example = "서울 송파구 올림픽로 424")
        String address,

        @Schema(description = "연락처", example = "02-000-0000")
        String phone
) {

    public static StadiumSummaryResponse from(Stadium stadium) {
        return new StadiumSummaryResponse(
                stadium.getId(), stadium.getName(), stadium.getAddress(), stadium.getPhone());
    }
}
