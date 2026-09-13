package com.teacat.server.booking.controller;

import com.teacat.server.booking.dto.response.ScheduleSeatMapResponse;
import com.teacat.server.booking.service.SeatMapService;
import com.teacat.server.common.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 좌석맵 조회.
 *
 * <p>선점(쓰기)과 달리 <b>로그인 없이도 볼 수 있습니다.</b> 잔여 좌석은 공개 정보이고,
 * 예매 오픈 전에 자리를 미리 살펴보는 것도 정상적인 사용입니다.
 * ({@code SecurityConfig} 의 {@code /schedules/**} GET 공개 규칙에 해당합니다)
 *
 * <p>{@link BookingController}(선점)와 분리한 이유: 그쪽은 전부 인증이 필요하고
 * 좌석을 바꾸는 API 라 성격이 다릅니다.
 */
@Tag(name = "좌석맵", description = "회차 좌석 현황 조회 API")
@RestController
@RequiredArgsConstructor
public class SeatMapController {

    private final SeatMapService seatMapService;

    @Operation(
            summary = "회차 좌석 현황 조회",
            description = """
                    좌석맵 한 장을 그리는 데 필요한 것을 **구역별로 묶어** 한 번에 내려줍니다.
                    구역(좌표·등급·가격)과 좌석(좌표·상태)을 따로 부르면 호출 사이에 좌석이 팔려
                    구역의 잔여 수와 좌석맵이 어긋나 보입니다.

                    - 좌석 선택 화면은 이 응답을 **3초 주기로 폴링**합니다. 캐시하지 마세요.
                    - `status` 는 `AVAILABLE` · `HELD` · `SOLD` · `BLOCKED` 입니다.
                      **만료된 선점은 `AVAILABLE` 로 내려갑니다** — 이미 다른 사람이 잡을 수 있는
                      좌석이라 화면에서도 고를 수 있어야 합니다.
                    - **누가 선점했는지는 내려주지 않습니다.** 비로그인도 보는 화면입니다.
                    - `serverTime` 은 클라이언트 시계를 믿지 않기 위한 기준 시각입니다.
                    - 스탠딩도 위치가 없는 가상 좌석을 가지며 각 입장권 재고에 `seatId`가 제공됩니다.
                    - 회차 좌석을 아직 생성하지 않았다면(`POST /admin/schedules/{id}/seats`)
                      좌석은 `BLOCKED` 로 내려갑니다 — 도면은 보이되 예매는 되지 않습니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(
                    responseCode = "404",
                    description = "`ERR_BOOKING_001` : 존재하지 않는 공연 회차",
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = @ExampleObject(
                                    name = "ERR_BOOKING_001",
                                    value = """
                                            {
                                              "success": false,
                                              "code": "ERR_BOOKING_001",
                                              "message": "존재하지 않는 공연 회차입니다."
                                            }
                                            """
                            )
                    )
            )
    })
    @GetMapping("/schedules/{scheduleId}/seats")
    public ResponseEntity<BaseResponse<ScheduleSeatMapResponse>> getSeatMap(
            @Parameter(description = "공연 회차 ID", example = "3")
            @PathVariable Long scheduleId,

            @Parameter(description = "특정 구역만 조회. 비우면 전 구역", example = "4")
            @RequestParam(required = false) Long areaId
    ) {
        return ResponseEntity.ok(BaseResponse.success(seatMapService.getSeatMap(scheduleId, areaId)));
    }
}
