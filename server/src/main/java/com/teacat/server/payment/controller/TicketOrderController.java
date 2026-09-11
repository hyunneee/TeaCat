package com.teacat.server.payment.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.payment.dto.request.TicketOrderConfirmRequest;
import com.teacat.server.payment.dto.request.TicketOrderPrepareRequest;
import com.teacat.server.payment.dto.response.TicketOrderPrepareResponse;
import com.teacat.server.payment.dto.response.TicketOrderResponse;
import com.teacat.server.payment.service.TicketCancelService;
import com.teacat.server.payment.service.TicketOrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "티켓 결제", description = "선점한 좌석을 캣머니 + 카드로 결제하고 티켓을 발권하는 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/payments/ticket-orders")
@RequiredArgsConstructor
public class TicketOrderController {

    private final TicketOrderService ticketOrderService;
    private final TicketCancelService ticketCancelService;

    @Operation(
            summary = "주문 준비",
            description = """
                    선점해 둔 좌석으로 주문을 열고 결제 금액을 확정합니다.

                    - **캣머니 사용분은 서버가 정합니다.** 가용 잔액을 읽어 티켓 값 한도 안에서
                      최대한 채우고, 남은 금액만 카드로 받습니다. 화면에 보여주는 값은 어림값이고
                      이 응답이 정답입니다.
                    - 확정된 캣머니는 **즉시 묶입니다.** 결제창을 띄워둔 채로 같은 잔액을 경매
                      입찰 등에 다시 쓸 수 없습니다.
                    - `cashAmount`가 0이면 **결제창을 띄우지 마세요.** 토스는 0원 결제를 받지
                      않습니다. `orderId`도 내려가지 않으며, 승인 API를 바로 호출하면 됩니다.
                    - 좌석을 먼저 선점해야 합니다. 선점이 없거나 만료됐으면 거절됩니다.
                    - 얼굴 정보가 없으면 거절됩니다 — 티켓은 얼굴 없이 발권될 수 없습니다.
                    - **같은 좌석으로 다시 호출하면 열려 있던 주문을 그대로 돌려줍니다.**
                      결제창을 닫았다가 다시 결제할 때 주문이 중복으로 생기지 않고, 이미 묶인
                      캣머니도 그대로 유지됩니다 (`ticketOrderId`·금액이 처음과 같습니다).
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "준비 성공"),
            @ApiResponse(
                    responseCode = "403",
                    description = """
                            - `ERR_BOOKING_008` : 본인이 선점한 좌석이 아님
                            - `ERR_BOOKING_011` : 얼굴 정보 미등록
                            """,
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = @ExampleObject(
                                    name = "ERR_BOOKING_011",
                                    value = """
                                            {
                                              "success": false,
                                              "code": "ERR_BOOKING_011",
                                              "message": "얼굴 정보를 먼저 등록해 주세요."
                                            }
                                            """
                            )
                    )
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = """
                            - `ERR_BOOKING_001` : 존재하지 않는 공연 회차
                            - `ERR_BOOKING_002` : 존재하지 않는 좌석
                            - `ERR_BOOKING_007` : 선점한 좌석이 없음
                            """,
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = """
                            - `ERR_BOOKING_005` : 이미 판매된 좌석
                            - `ERR_BOOKING_009` : 좌석 선점이 만료됨
                            - `PAYMENT_009` : 구역 가격이 설정되지 않음
                            - `PAYMENT_010` : 1인 최대 매수 초과
                            - `PAYMENT_016` : 같은 좌석으로 요청이 겹쳐 밀림 (다시 호출하면 됩니다)
                            """,
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            )
    })
    @PostMapping
    public ResponseEntity<BaseResponse<TicketOrderPrepareResponse>> prepare(
            @Valid @RequestBody TicketOrderPrepareRequest request,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(ticketOrderService.open(
                authUser.id(), request.performanceDetailId(), request.seatId())));
    }

    @Operation(
            summary = "주문 승인",
            description = """
                    결제를 승인하고 티켓을 발권합니다. **이 요청이 성공하면 실제로 결제가 완료됩니다.**

                    - 카드 결제가 있었다면 결제창이 돌려준 `paymentKey`·`amount`를 함께 보냅니다.
                      **전액 캣머니 결제였다면 둘을 생략**하세요 — 토스를 거치지 않았습니다.
                    - 성공하면 좌석이 판매 확정되고 티켓이 발권됩니다. 이어서 캣머니 소각과
                      NFT 발행이 **비동기로** 나갑니다.
                    - 응답의 `nftStatus`가 `PENDING`이면 NFT 발행이 체인 확정을 기다리는 중입니다
                      (보통 10초 내외). **예매는 이미 유효합니다.** 실패로 보여주지 마세요.
                    - **같은 요청을 다시 보내도 안전합니다.** 이미 발권된 주문은 같은 티켓을
                      다시 돌려줍니다 (결제 완료 화면 새로고침 대응).
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "승인·발권 성공"),
            @ApiResponse(
                    responseCode = "400",
                    description = """
                            - `PAYMENT_005` : 결제 금액이 서버 기록과 다름 (또는 카드 결제인데 결제 키가 없음)
                            - `PAYMENT_007` : 토스가 승인을 거절함
                            """,
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "`PAYMENT_004` : 본인의 주문이 아님",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "`PAYMENT_011` : 존재하지 않는 주문",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = """
                            - `PAYMENT_006` : 이미 처리 중이거나 실패로 끝난 주문
                            - `PAYMENT_012` : 좌석 선점이 유지되지 않아 발권 불가
                            - `ERR_BOOKING_009` : 좌석 선점이 만료됨
                            """,
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = @ExampleObject(
                                    name = "PAYMENT_012",
                                    value = """
                                            {
                                              "success": false,
                                              "code": "PAYMENT_012",
                                              "message": "좌석 선점이 유지되지 않아 발권할 수 없습니다. 좌석을 다시 선택해 주세요."
                                            }
                                            """
                            )
                    )
            )
    })
    @PostMapping("/confirm")
    public ResponseEntity<BaseResponse<TicketOrderResponse>> confirm(
            @Valid @RequestBody TicketOrderConfirmRequest request,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(
                ticketOrderService.confirm(authUser.id(), request)));
    }

    @Operation(
            summary = "주문 단건 조회",
            description = """
                    주문과 NFT 발행 상태를 확인합니다. 승인 응답이 `PENDING`이면 이 API로 확인하세요.

                    - `nftStatus`가 `SUCCESS`가 되면 체인에 올라간 것입니다.
                    - `FAILED`여도 **예매 자체는 유효합니다.** 서버가 재시도합니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(
                    responseCode = "403",
                    description = "`PAYMENT_004` : 본인의 주문이 아님",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "`PAYMENT_011` : 존재하지 않는 주문",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            )
    })
    @GetMapping("/{ticketOrderId}")
    public ResponseEntity<BaseResponse<TicketOrderResponse>> getOrder(
            @Parameter(description = "주문 ID", example = "31")
            @PathVariable Long ticketOrderId,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(
                ticketOrderService.getOrder(authUser.id(), ticketOrderId)));
    }

    @Operation(
            summary = "예매 취소",
            description = """
                    예매를 취소하고 환불을 시작합니다.

                    - **취소 마감(공연 시작 전 일정 시간)이 지나면 취소할 수 없습니다** (예매 정책).
                      지난 뒤에는 `PAYMENT_014`로 거절됩니다.
                    - 응답이 돌아온 시점에 **예매는 이미 무효화됐고 좌석도 풀렸습니다.**
                      환불(카드 취소 · 캣머니 환급 · NFT 소각)은 뒤이어 비동기로 진행됩니다.
                    - **환불이 아직 안 끝났어도 취소는 성공입니다.** 서버가 끝까지 재시도하므로
                      실패로 보여주지 마세요. 카드 환불은 카드사 사정으로 며칠 걸릴 수 있습니다.
                    - 같은 요청을 다시 보내면 `PAYMENT_015`로 거절됩니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "취소 성공 (환불은 진행 중)"),
            @ApiResponse(
                    responseCode = "403",
                    description = "`PAYMENT_004` : 본인의 주문이 아님",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "`PAYMENT_011` : 존재하지 않는 주문",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = """
                            - `PAYMENT_006` : 결제가 끝나지 않은 주문
                            - `PAYMENT_014` : 취소 마감(공연 시작 전 일정 시간)이 지나 취소 불가
                            - `PAYMENT_015` : 이미 취소된 예매
                            - `PAYMENT_017` : 카드팩을 이미 열어 카드가 발행된 예매라 취소 불가
                            """,
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = @ExampleObject(
                                    name = "PAYMENT_014",
                                    value = """
                                            {
                                              "success": false,
                                              "code": "PAYMENT_014",
                                              "message": "공연 시작이 임박하여 취소할 수 없습니다."
                                            }
                                            """
                            )
                    )
            )
    })
    @PostMapping("/{ticketOrderId}/cancel")
    public ResponseEntity<BaseResponse<TicketOrderResponse>> cancel(
            @Parameter(description = "주문 ID", example = "31")
            @PathVariable Long ticketOrderId,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success("예매가 취소되었습니다. 환불이 진행됩니다.",
                ticketCancelService.cancel(authUser.id(), ticketOrderId)));
    }
}
