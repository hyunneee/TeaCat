package com.teacat.server.booking.dto.response;

import com.teacat.server.stadium.entity.AreaType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.List;

/**
 * 좌석맵의 구역 한 덩어리.
 *
 * 공연장 구역(좌표·코드)과 공연별 설정(등급·가격)을 합쳐서 준다.
 * 프론트가 구역 API 와 좌석 API 를 따로 불러 조인하지 않도록 한 응답에 담는다 —
 * 따로 부르면 두 응답 사이에 좌석이 팔려서 잔여 수가 어긋난다.
 */
@Schema(description = "좌석맵 구역")
public record SeatMapAreaResponse(

        @Schema(description = "구역 ID", example = "4")
        Long areaId,

        @Schema(description = "구역 코드", example = "FRONT")
        String areaCode,

        @Schema(description = "구역 유형", example = "SEATED")
        AreaType type,

        @Schema(description = "좌석 등급. 공연 구역 설정이 없으면 null", example = "VIP")
        String grade,

        @Schema(description = "가격(원). 공연 구역 설정이 없으면 null", example = "165000")
        Integer price,

        @Schema(description = "도면상 구역 X", example = "119.33")
        BigDecimal areaX,

        @Schema(description = "도면상 구역 Y", example = "171")
        BigDecimal areaY,

        @Schema(description = "도면상 구역 너비", example = "843.33")
        BigDecimal width,

        @Schema(description = "도면상 구역 높이", example = "275.33")
        BigDecimal height,

        @Schema(description = "이 구역의 좌석 수", example = "30")
        int seatCount,

        @Schema(description = "지금 고를 수 있는 좌석 수", example = "28")
        int availableCount,

        @Schema(description = "좌석 목록")
        List<SeatStatusResponse> seats
) {
}
