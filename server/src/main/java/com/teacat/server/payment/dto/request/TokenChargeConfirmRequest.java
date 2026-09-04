package com.teacat.server.payment.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 결제창에서 성공으로 돌아올 때 토스가 넘겨준 값 세 개를 그대로 올려보냅니다.
 *
 * <p>{@code amount} 는 <b>확인용</b>입니다. 서버는 이 값을 믿지 않고 주문번호로 찾은
 * 결제 금액과 대조합니다 — 다르면 위조로 보고 거절합니다.
 */
@Schema(description = "캣머니 충전 승인 요청")
public record TokenChargeConfirmRequest(

        @Schema(description = "토스가 발급한 결제 키", example = "tviva20240101000000ABCDE",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "결제 키는 필수입니다.")
        String paymentKey,

        @Schema(description = "충전 준비 때 받은 주문번호", example = "tc_1f0a7f0e-2b3c-4d5e-8f90-1a2b3c4d5e6f",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "주문번호는 필수입니다.")
        String orderId,

        @Schema(description = "결제 금액(원)", example = "10000",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "결제 금액은 필수입니다.")
        @Positive(message = "결제 금액은 0보다 커야 합니다.")
        Integer amount
) {
}
