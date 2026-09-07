package com.teacat.server.booking.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.booking.dto.response.MyHoldResponse;
import com.teacat.server.booking.dto.response.SeatHoldResponse;
import com.teacat.server.booking.service.BookingService;
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
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "좌석 선점", description = "좌석 선점(HOLD) · 해제 · 내 선점 목록 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequiredArgsConstructor
public class BookingController {

    // 선점/해제는 회차 하위 리소스이고 내 선점 목록은 사용자 기준이라 루트가 다르다.
    // 클래스 레벨 @RequestMapping 으로는 두 루트를 담을 수 없어 메서드마다 전체 경로를 쓴다.
    private static final String SEAT_PATH = "/performance-details/{performanceDetailId}/seats/{seatId}";

    private final BookingService bookingService;

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
                    - 선점 시간이 만료된 좌석은 다른 사용자가 곧바로 재선점할 수 있습니다.
                      본인의 만료된 선점도 새 좌석을 선점할 때 자동으로 해제됩니다.
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
    @PostMapping(SEAT_PATH + "/hold")
    public ResponseEntity<BaseResponse<SeatHoldResponse>> holdSeat(
            @Parameter(description = "공연 회차 ID", example = "45")
            @PathVariable Long performanceDetailId,

            @Parameter(description = "선점할 좌석 ID", example = "1024")
            @PathVariable Long seatId,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(
                bookingService.holdSeat(performanceDetailId, seatId, authUser.id())));
    }

    @Operation(
            summary = "좌석 선점 해제",
            description = """
                    본인이 선점한 좌석을 해제하여 다시 예매 가능한 상태로 되돌립니다.
                    좌석을 변경하거나 예매를 중단할 때 호출합니다.

                    - **본인이 선점한 좌석만 해제할 수 있습니다.** 다른 사용자가 선점한 좌석에 대한
                      요청은 `ERR_BOOKING_008`로 거절되며, 그 선점에는 어떤 영향도 주지 않습니다.
                    - 이미 만료된 선점은 해제 대상이 아니라 `ERR_BOOKING_009`로 응답합니다.
                      좌석을 다시 선택해야 합니다.
                    - 해제 후에는 다른 사용자가 곧바로 그 좌석을 선점할 수 있습니다.
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
    @DeleteMapping(SEAT_PATH + "/hold")
    public ResponseEntity<BaseResponse<Void>> releaseSeat(
            @Parameter(description = "공연 회차 ID", example = "45")
            @PathVariable Long performanceDetailId,

            @Parameter(description = "해제할 좌석 ID", example = "1024")
            @PathVariable Long seatId,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        bookingService.releaseSeat(performanceDetailId, seatId, authUser.id());
        return ResponseEntity.ok(BaseResponse.success("좌석 선점이 해제되었습니다."));
    }

    @Operation(
            summary = "내 선점 좌석 목록",
            description = """
                    현재 내가 선점 중인 좌석을 결제 화면에 필요한 정보와 함께 조회합니다.
                    결제 페이지 진입점으로 사용합니다.

                    - 1인 1매 제약은 **회차 단위**이므로, 회차가 다르면 여러 건이 나올 수 있습니다.
                    - 조회 직전에 만료된 선점을 정리하므로 **유효한 선점만** 내려갑니다.
                      선점이 없으면 빈 배열입니다.
                    - `remainingSeconds` 는 서버(DB) 시계로 계산한 값입니다.
                      클라이언트 시계로 `heldUntil` 을 다시 계산하지 말고 이 값으로 타이머를 돌리세요.
                    - 만료가 임박한 순서(`heldUntil` 오름차순)로 정렬됩니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공 (선점이 없으면 빈 배열)")
    })
    @GetMapping("/me/holds")
    public ResponseEntity<BaseResponse<List<MyHoldResponse>>> getMyHolds(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(bookingService.getMyHolds(authUser.id())));
    }
}
