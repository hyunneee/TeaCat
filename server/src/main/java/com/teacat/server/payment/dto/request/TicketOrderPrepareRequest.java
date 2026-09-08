package com.teacat.server.payment.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * 티켓 주문 준비 요청.
 *
 * <p><b>금액을 받지 않습니다.</b> 티켓 값도, 캣머니 사용분도 서버가 정합니다 — 프론트가 보내면
 * 조작해서 카드 결제액을 줄일 수 있습니다.
 *
 * <p>좌석은 미리 선점(HOLD)돼 있어야 합니다. 선점이 없거나 만료됐으면 거절됩니다.
 */
@Schema(description = "티켓 주문 준비 요청")
public record TicketOrderPrepareRequest(

        @Schema(description = "공연 회차 ID", example = "45",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "공연 회차 ID는 필수입니다.")
        Long performanceDetailId,

        @Schema(description = "선점해 둔 좌석 ID", example = "1024",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "좌석 ID는 필수입니다.")
        Long seatId
) {
}
