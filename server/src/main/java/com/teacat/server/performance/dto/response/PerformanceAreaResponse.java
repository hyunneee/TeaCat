package com.teacat.server.performance.dto.response;

import com.teacat.server.performance.entity.PerformanceArea;
import com.teacat.server.stadium.entity.AreaType;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "공연 구역 설정")
public record PerformanceAreaResponse(

        @Schema(description = "공연장 구역 ID", example = "1")
        Long areaId,

        @Schema(description = "구역 코드", example = "A")
        String areaCode,

        @Schema(description = "공연장 구역의 형태. 공연장 배치에 좌석이 그려져 있으면 SEATED 다. "
                + "이 값이 STANDING 이면 그 구역은 어떤 공연에서도 좌석제로 팔 수 없다", example = "SEATED")
        AreaType areaType,

        @Schema(description = "이 공연에서 파는 방식. areaType 과 다를 수 있다 — 좌석제 구역을 "
                + "스탠딩으로 파는 경우다. 좌석 생성·좌석맵은 이 값을 본다", example = "SEATED")
        AreaType saleType,

        @Schema(description = "좌석 등급", example = "VIP")
        String grade,

        @Schema(description = "가격 (원)", example = "165000")
        Integer price,

        @Schema(description = "최대 판매수량", example = "500")
        Integer maxCnt,

        @Schema(description = "판매된 수량. 확정된 티켓을 센 값입니다.", example = "0")
        long soldCnt
) {

    /** @param soldCount 확정 티켓 수. 저장된 값이 아니라 셀 때마다 세는 값이다 */
    public static PerformanceAreaResponse of(PerformanceArea performanceArea, long soldCount) {
        return new PerformanceAreaResponse(
                performanceArea.getArea().getId(),
                performanceArea.getArea().getAreaCode(),
                performanceArea.getArea().getType(),
                performanceArea.getSaleType(),
                performanceArea.getGrade(),
                performanceArea.getPrice(),
                performanceArea.getMaxCnt(),
                soldCount
        );
    }
}
