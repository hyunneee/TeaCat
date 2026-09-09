package com.teacat.server.payment.dto.response;

import com.teacat.server.payment.entity.TokenCharge;
import com.teacat.server.wallet.entity.CatTransaction;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "캣머니 충전 결과")
public record TokenChargeResponse(

        @Schema(description = "충전 ID. 반영 상태를 다시 조회할 때 씁니다.", example = "12")
        Long chargeId,

        @Schema(description = "주문번호", example = "tc_1f0a7f0e-2b3c-4d5e-8f90-1a2b3c4d5e6f")
        String orderId,

        @Schema(description = "결제 금액(원)", example = "10000")
        int amount,

        @Schema(description = "지급되는 캣머니", example = "10000")
        long tokenAmount,

        @Schema(description = """
                반영 상태.
                - `MINTING` : 결제는 끝났고 캣머니 발행이 확정되기를 기다리는 중입니다 (보통 10초 내외)
                - `COMPLETED` : 잔액에 반영됐습니다
                - `FAILED` : 발행이 실패했습니다. 재시도 대상입니다
                """, example = "MINTING")
        TokenChargeStatus status,

        @Schema(description = "결제 승인 시각", example = "2026-09-04T18:31:22")
        LocalDateTime approvedAt,

        @Schema(description = "매출전표 주소", example = "https://dashboard.tosspayments.com/receipt/...")
        String receiptUrl
) {

    public static TokenChargeResponse from(TokenCharge charge) {
        CatTransaction mintTx = charge.getMintTx();

        return new TokenChargeResponse(
                charge.getId(),
                charge.getPayment().getOrderId(),
                charge.getPayment().getAmount(),
                charge.getAmount(),
                TokenChargeStatus.from(mintTx == null ? null : mintTx.getStatus()),
                charge.getPayment().getApprovedAt(),
                charge.getPayment().getReceiptUrl());
    }
}
