package com.teacat.server.payment.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 티켓 주문 승인 요청.
 *
 * <p>카드로 낼 금액이 있었다면 결제창이 돌려준 {@code paymentKey}·{@code amount} 를 함께 보냅니다.
 * <b>전액 캣머니 결제였다면 둘을 생략합니다</b> — 토스를 거치지 않았으니 결제 키가 없습니다.
 *
 * <p>{@code amount} 는 확인용입니다. 서버는 이 값을 믿지 않고 주문에 확정해 둔 카드 금액과
 * 대조합니다 — 다르면 위조로 보고 거절합니다.
 */
@Schema(description = "티켓 주문 승인 요청")
public record TicketOrderConfirmRequest(

        @Schema(description = "주문 준비에서 받은 주문 ID", example = "31",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "주문 ID는 필수입니다.")
        Long ticketOrderId,

        @Schema(description = "토스가 발급한 결제 키. 전액 캣머니 결제면 생략합니다.",
                example = "tviva20240101000000ABCDE")
        String paymentKey,

        @Schema(description = "결제창이 알려준 카드 결제 금액(원). 전액 캣머니 결제면 생략합니다.",
                example = "76599")
        @Positive(message = "결제 금액은 0보다 커야 합니다.")
        Integer amount
) {

    /** 카드 결제 결과를 실어 온 요청인가 */
    public boolean hasCardResult() {
        return paymentKey != null && !paymentKey.isBlank() && amount != null;
    }
}
