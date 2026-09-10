package com.teacat.server.payment.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.payment.dto.request.TokenChargeConfirmRequest;
import com.teacat.server.payment.dto.request.TokenChargePrepareRequest;
import com.teacat.server.payment.dto.response.TokenChargePrepareResponse;
import com.teacat.server.payment.dto.response.TokenChargeResponse;
import com.teacat.server.payment.service.TokenChargeService;
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

@Tag(name = "캣머니 충전", description = "토스 결제로 캣머니를 충전하는 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/payments/token-charges")
@RequiredArgsConstructor
public class TokenChargeController {

    private final TokenChargeService tokenChargeService;

    @Operation(
            summary = "충전 준비",
            description = """
                    결제창을 띄우기 전에 주문번호와 금액을 확정합니다.

                    - **금액은 서버가 확정합니다.** 응답의 `amount`를 그대로 결제창에 넘기세요.
                      승인 때 서버가 다시 대조하므로, 결제창에 다른 금액을 넣으면 `PAYMENT_005`로 거절됩니다.
                    - `customerKey`는 회원마다 고정된 값입니다. 결제위젯에 그대로 넘기세요.
                    - 캣머니는 원화와 1:1 입니다. 10,000원을 결제하면 10,000 캣머니가 지급됩니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "준비 성공"),
            @ApiResponse(
                    responseCode = "400",
                    description = "`PAYMENT_002` : 충전 가능한 금액 범위를 벗어남",
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = @ExampleObject(
                                    name = "PAYMENT_002",
                                    value = """
                                            {
                                              "success": false,
                                              "code": "PAYMENT_002",
                                              "message": "충전 가능한 금액 범위를 벗어났습니다."
                                            }
                                            """
                            )
                    )
            )
    })
    @PostMapping
    public ResponseEntity<BaseResponse<TokenChargePrepareResponse>> prepare(
            @Valid @RequestBody TokenChargePrepareRequest request,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(
                tokenChargeService.prepare(authUser.id(), request.amount())));
    }

    @Operation(
            summary = "충전 승인",
            description = """
                    결제창이 성공으로 돌아올 때 받은 값으로 결제를 승인하고 캣머니를 발행합니다.

                    - **이 요청이 성공하면 실제로 결제가 완료됩니다.**
                    - 응답의 `status`가 `MINTING`이면 결제는 끝났고 캣머니 발행이 확정되기를
                      기다리는 중입니다 (보통 10초 내외). 잔액에 아직 안 잡히는 것이 정상입니다.
                      충전 단건 조회로 `COMPLETED`가 될 때까지 확인하세요.
                    - **같은 요청을 다시 보내도 안전합니다.** 이미 승인된 결제는 다시 승인하지 않고
                      같은 결과를 돌려줍니다 (리다이렉트 화면 새로고침 대응).
                    - `amount`는 확인용입니다. 서버가 준비 단계에서 확정한 금액과 다르면 거절됩니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "승인 성공"),
            @ApiResponse(
                    responseCode = "400",
                    description = """
                            - `PAYMENT_005` : 결제 금액이 서버 기록과 다름
                            - `PAYMENT_007` : 토스가 승인을 거절함 (한도 초과·카드사 거절 등)
                            """,
                    content = @Content(
                            schema = @Schema(implementation = BaseResponse.class),
                            examples = {
                                    @ExampleObject(
                                            name = "PAYMENT_005",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "PAYMENT_005",
                                                      "message": "결제 금액이 일치하지 않습니다."
                                                    }
                                                    """
                                    ),
                                    @ExampleObject(
                                            name = "PAYMENT_007",
                                            value = """
                                                    {
                                                      "success": false,
                                                      "code": "PAYMENT_007",
                                                      "message": "결제 승인에 실패했습니다."
                                                    }
                                                    """
                                    )
                            }
                    )
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "`PAYMENT_004` : 본인의 결제가 아님",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "`PAYMENT_003` : 존재하지 않는 주문번호",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "`PAYMENT_006` : 다른 요청이 승인 중이거나 이미 실패로 끝난 결제",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            )
    })
    @PostMapping("/confirm")
    public ResponseEntity<BaseResponse<TokenChargeResponse>> confirm(
            @Valid @RequestBody TokenChargeConfirmRequest request,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(
                tokenChargeService.confirm(authUser.id(), request)));
    }

    @Operation(
            summary = "충전 단건 조회",
            description = """
                    충전이 잔액에 반영됐는지 확인합니다. 승인 응답이 `MINTING`이면 이 API로 확인하세요.

                    - `COMPLETED`가 되면 캣머니 잔액 조회에 반영되어 있습니다.
                    - `FAILED`는 발행이 체인에서 거부된 경우입니다. 서버가 재시도하므로 잠시 후
                      다시 조회하면 `COMPLETED`가 될 수 있습니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(
                    responseCode = "403",
                    description = "`PAYMENT_004` : 본인의 충전이 아님",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "`PAYMENT_008` : 존재하지 않는 충전 내역",
                    content = @Content(schema = @Schema(implementation = BaseResponse.class))
            )
    })
    @GetMapping("/{chargeId}")
    public ResponseEntity<BaseResponse<TokenChargeResponse>> getCharge(
            @Parameter(description = "충전 ID", example = "12")
            @PathVariable Long chargeId,

            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser
    ) {
        return ResponseEntity.ok(BaseResponse.success(
                tokenChargeService.getCharge(authUser.id(), chargeId)));
    }
}
