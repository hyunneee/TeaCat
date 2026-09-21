package com.teacat.server.resale.dto.response;

import com.teacat.server.performance.entity.PerformanceArea;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "취소표 대기 — 구역 현황")
public record ResaleSectionResponse(
        @Schema(description = "구역(area) ID. 문자열", example = "12")
        String sectionId,
        @Schema(description = "구역 코드", example = "A")
        String name,
        @Schema(description = "등급", example = "VIP")
        String grade,
        @Schema(description = "가격(원)", example = "154000")
        int price,
        @Schema(description = "현재 이 구역 대기 인원", example = "37")
        long waitingCount,
        @Schema(description = "매진 여부. 취소표 대기는 매진된 구역에만 걸 수 있다", example = "true")
        boolean soldOut
) {
    public static ResaleSectionResponse of(PerformanceArea area, long waitingCount, boolean soldOut) {
        return new ResaleSectionResponse(
                area.getArea().getId().toString(),
                area.getArea().getAreaCode(),
                area.getGrade(),
                area.getPrice() == null ? 0 : area.getPrice(),
                waitingCount,
                soldOut);
    }
}
