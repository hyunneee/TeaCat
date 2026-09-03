package com.teacat.server.booking.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.booking.dto.response.SeatHoldResponse;
import com.teacat.server.common.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "좌석 선점", description = "공연 회차별 좌석 선점(HOLD) API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/performance-details/{performanceDetailId}/seats")
public class BookingController {

    @Operation(
            summary = "좌석 선점",
            description = """
                    `seatId`로 좌석을 선점(HOLD)하고 결제 제한시간을 부여합니다.

                    - **한 사용자는 동시에 하나의 좌석만 선점할 수 있습니다.**
                      다른 좌석을 선점 중이면 `ERR_BOOKING_006`으로 실패하므로,
                      좌석을 변경할 때는 선점 해제 API를 먼저 호출해야 합니다.
                    - **선점 시간 연장은 불가능합니다.** 이미 본인이 선점한 좌석을
                      다시 선점하면 `ERR_BOOKING_010`으로 실패합니다.
                      만료 시각은 최초 선점 시점에 확정되며 재요청으로 갱신되지 않습니다.
                    - 선점 시간이 만료된 다른 사용자의 좌석은 재선점 가능합니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "선점 성공"),
            @ApiResponse(
                    responseCode = "404",
                    description = """
                            - `ERR_BOOKING_001` : 존재하지 않는 공연 회차
                            - `ERR_BOOKING_002` : 해당 회차에 존재하지 않는 좌석
                            """,
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = {
                                    @ExampleObject(
                                            name = "ERR_BOOKING_001",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "ERR_BOOKING_001",
                                                      "message": "존재하지 않는 공연 회차입니다."
                                                    }
                                                    """
                                    ),
                                    @ExampleObject(
                                            name = "ERR_BOOKING_002",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "ERR_BOOKING_002",
                                                      "message": "해당 회차에 존재하지 않는 좌석입니다."
                                                    }
                                                    """
                                    )
                            }
                    )
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = """
                            - `ERR_BOOKING_003` : 예매 가능한 시간이 아님
                            - `ERR_BOOKING_004` : 다른 사용자가 선점한 좌석
                            - `ERR_BOOKING_005` : 이미 판매된 좌석
                            - `ERR_BOOKING_006` : 다른 좌석을 선점 중 (1인 1좌석)
                            - `ERR_BOOKING_010` : 본인이 이미 선점한 좌석 (연장 불가)
                            """,
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = {
                                    @ExampleObject(
                                            name = "ERR_BOOKING_003",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "ERR_BOOKING_003",
                                                      "message": "예매 가능한 시간이 아닙니다."
                                                    }
                                                    """
                                    ),
                                    @ExampleObject(
                                            name = "ERR_BOOKING_004",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "ERR_BOOKING_004",
                                                      "message": "다른 사용자가 선점한 좌석입니다."
                                                    }
                                                    """
                                    ),
                                    @ExampleObject(
                                            name = "ERR_BOOKING_005",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "ERR_BOOKING_005",
                                                      "message": "이미 판매된 좌석입니다."
                                                    }
                                                    """
                                    ),
                                    @ExampleObject(
                                            name = "ERR_BOOKING_006",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "ERR_BOOKING_006",
                                                      "message": "이미 선점한 좌석이 있습니다. 기존 좌석을 해제한 후 다시 선택해주세요."
                                                    }
                                                    """
                                    ),
                                    @ExampleObject(
                                            name = "ERR_BOOKING_010",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "ERR_BOOKING_010",
                                                      "message": "이미 선점한 좌석입니다. 선점 시간은 연장할 수 없습니다."
                                                    }
                                                    """
                                    )
                            }
                    )
            )
    })
    @PostMapping("/{seatId}/hold")
    public ResponseEntity<BaseResponse<SeatHoldResponse>> holdSeat(
            @Parameter(description = "공연 회차 ID", example = "45")
            @PathVariable Long performanceDetailId,

            @Parameter(description = "선점할 좌석 ID", example = "1024")
            @PathVariable Long seatId,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        throw new UnsupportedOperationException("TODO: 좌석 선점 구현");
    }

    @Operation(
            summary = "좌석 선점 해제",
            description = """
                    본인이 선점한 좌석을 해제하여 다시 예매 가능한 상태로 되돌립니다.
                    좌석을 변경하거나 예매를 중단할 때 호출합니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "해제 성공"),
            @ApiResponse(
                    responseCode = "403",
                    description = "`ERR_BOOKING_008` : 본인이 선점한 좌석이 아님",
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = @ExampleObject(
                                    name = "ERR_BOOKING_008",
                                    value = """
                                            {
                                              "success": false,
                                              "code": "ERR_BOOKING_008",
                                              "message": "본인이 선점한 좌석이 아닙니다."
                                            }
                                            """
                            )
                    )
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = """
                            - `ERR_BOOKING_002` : 해당 회차에 존재하지 않는 좌석
                            - `ERR_BOOKING_007` : 선점한 좌석이 없음
                            """,
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = {
                                    @ExampleObject(
                                            name = "ERR_BOOKING_002",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "ERR_BOOKING_002",
                                                      "message": "해당 회차에 존재하지 않는 좌석입니다."
                                                    }
                                                    """
                                    ),
                                    @ExampleObject(
                                            name = "ERR_BOOKING_007",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "ERR_BOOKING_007",
                                                      "message": "선점한 좌석이 없습니다."
                                                    }
                                                    """
                                    )
                            }
                    )
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "`ERR_BOOKING_009` : 선점 시간이 이미 만료됨",
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = @ExampleObject(
                                    name = "ERR_BOOKING_009",
                                    value = """
                                            {
                                              "success": false,
                                              "code": "ERR_BOOKING_009",
                                              "message": "좌석 선점 시간이 만료되었습니다. 좌석을 다시 선택해주세요."
                                            }
                                            """
                            )
                    )
            )
    })
    @DeleteMapping("/{seatId}/hold")
    public ResponseEntity<BaseResponse<Void>> releaseSeat(
            @Parameter(description = "공연 회차 ID", example = "45")
            @PathVariable Long performanceDetailId,

            @Parameter(description = "해제할 좌석 ID", example = "1024")
            @PathVariable Long seatId,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        throw new UnsupportedOperationException("TODO: 좌석 선점 해제 구현");
    }
}
