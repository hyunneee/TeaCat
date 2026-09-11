package com.teacat.server.payment.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

@Schema(description = "캣머니 충전 준비 요청")
public record TokenChargePrepareRequest(

        @Schema(description = "충전할 금액(원). 캣머니는 원화와 1:1 이라 같은 수량이 지급됩니다.",
                example = "10000", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "충전 금액은 필수입니다.")
        @Positive(message = "충전 금액은 0보다 커야 합니다.")
        Integer amount
) {
}
