package com.teacat.server.booking.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 회차 좌석 현황 (좌석맵 한 장).
 *
 * 좌석 선택 화면이 3초 주기로 폴링하는 응답이다.
 */
@Schema(description = "회차 좌석 현황")
public record ScheduleSeatMapResponse(

        @Schema(description = "회차 ID", example = "3")
        Long scheduleId,

        @Schema(description = "응답을 만든 시점의 서버 시각. 클라이언트 시계를 믿지 않기 위해 함께 준다")
        LocalDateTime serverTime,

        @Schema(description = "구역별 좌석")
        List<SeatMapAreaResponse> areas
) {
}
