package com.teacat.server.payment.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * 결제창을 띄우는 데 필요한 값.
 *
 * <p>금액을 서버가 확정해서 내려준다는 점이 중요합니다. 프론트는 이 값을 그대로 결제창에
 * 넘기기만 하고, 승인 때 서버가 다시 대조합니다.
 */
@Schema(description = "캣머니 충전 준비 응답")
public record TokenChargePrepareResponse(

        @Schema(description = "주문번호. 결제창과 승인 요청에 그대로 사용합니다.",
                example = "tc_1f0a7f0e-2b3c-4d5e-8f90-1a2b3c4d5e6f")
        String orderId,

        @Schema(description = "결제창에 표시할 주문명", example = "캣머니 10,000 충전")
        String orderName,

        @Schema(description = "결제 금액(원). 서버가 확정한 값입니다.", example = "10000")
        int amount,

        @Schema(description = "토스 결제위젯이 요구하는 고객 식별자. 회원마다 고정입니다.",
                example = "9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f")
        UUID customerKey
) {
}
