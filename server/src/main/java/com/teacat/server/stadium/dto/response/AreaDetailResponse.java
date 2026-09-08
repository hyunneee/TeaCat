package com.teacat.server.stadium.dto.response;

import com.teacat.server.stadium.entity.AreaType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "공연장 구역 상세 정보")
public record AreaDetailResponse(
        @Schema(description = "구역 ID", example = "10") Long areaId,
        @Schema(description = "공연장 ID", example = "1") Long stadiumId,
        @Schema(description = "공연장 이름", example = "고척스카이돔") String stadiumName,
        @Schema(description = "구역 코드", example = "A") String areaCode,
        @Schema(description = "구역 유형", example = "SEATED") AreaType type,
        @Schema(description = "최대 수용 인원", example = "100") int maxSeat,
        @Schema(description = "등록 좌석 수", example = "100") long seatCount,
        @Schema(description = "구역 X 좌표", example = "10") BigDecimal areaX,
        @Schema(description = "구역 Y 좌표", example = "20") BigDecimal areaY,
        @Schema(description = "구역 너비", example = "300") BigDecimal width,
        @Schema(description = "구역 높이", example = "200") BigDecimal height
) {
}
