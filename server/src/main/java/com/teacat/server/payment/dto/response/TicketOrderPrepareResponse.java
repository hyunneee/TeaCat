package com.teacat.server.payment.dto.response;

import com.teacat.server.payment.entity.TicketOrder;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * 티켓 주문 준비 응답.
 *
 * <p><b>금액 분해는 서버가 확정합니다.</b> 프론트가 캣머니 사용분을 계산해 보내면 "내 잔액이
 * 5만원" 이라고 주장해 카드 결제액을 줄일 수 있습니다. 화면에 보여주는 값은 어림값이고,
 * 실제 차감량은 이 응답이 정답입니다.
 *
 * <p>{@code cashAmount} 가 0 이면 결제창을 띄우지 마세요 — 토스는 0원 결제를 받지 않습니다.
 * 그때는 {@code orderId} 도 없고, 승인 API 를 바로 부르면 됩니다.
 */
@Schema(description = "티켓 주문 준비 결과")
public record TicketOrderPrepareResponse(

        @Schema(description = "주문 ID", example = "31")
        Long ticketOrderId,

        @Schema(description = "결제창에 넘길 주문번호. 카드로 낼 금액이 없으면 생략됩니다.",
                example = "tc_1f0a7f0e-2b3c-4d5e-8f90-1a2b3c4d5e6f")
        String orderId,

        @Schema(description = "결제창에 표시할 주문명", example = "테아캣 콘서트 1회차 A구역 3열 12번")
        String orderName,

        @Schema(description = "티켓 가격(원)", example = "88000")
        int totalAmount,

        @Schema(description = "캣머니로 차감될 금액. 서버가 가용 잔액을 읽어 확정한 값입니다.",
                example = "11401")
        int tokenAmount,

        @Schema(description = "카드로 결제할 금액. 0이면 결제창 없이 승인만 부르면 됩니다.",
                example = "76599")
        int cashAmount,

        @Schema(description = "토스 결제위젯이 요구하는 고객 식별자. 카드 결제가 없으면 생략됩니다.",
                example = "9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f")
        UUID customerKey
) {

    public static TicketOrderPrepareResponse of(TicketOrder order, String orderName, UUID customerKey) {
        boolean card = order.requiresCardPayment();

        return new TicketOrderPrepareResponse(
                order.getId(),
                card ? order.getPayment().getOrderId() : null,
                orderName,
                order.getTotalAmount(),
                order.getTokenAmount(),
                order.getCashAmount(),
                card ? customerKey : null);
    }
}
