package com.teacat.server.stadium.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "공연장 목록 항목")
public record StadiumSummaryResponse(
        @Schema(description = "공연장 ID", example = "1") Long stadiumId,
        @Schema(description = "공연장 이름", example = "고척스카이돔") String name,
        @Schema(description = "공연장 주소", example = "서울 구로구 경인로 430") String address,
        @Schema(description = "공연장 전화번호", example = "02-2128-2300") String phone,
        @Schema(description = "구역 수", example = "3") long areaCount,
        @Schema(description = "물리적인 최대 수용 인원", example = "25000") int maxCapacity
) {
}
