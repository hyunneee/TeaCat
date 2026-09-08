package com.teacat.server.payment.dto.response;

import com.teacat.server.payment.entity.TicketOrder;
import com.teacat.server.nft.entity.NftTicket;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.UUID;

@Schema(description = "티켓 결제 결과")
public record TicketOrderResponse(

        @Schema(description = "주문 ID", example = "31")
        Long ticketOrderId,

        @Schema(description = "발권된 티켓 ID", example = "7")
        Long ticketId,

        @Schema(description = "NFT 발행 키. 발행 전이면 생략됩니다.",
                example = "3f2b9c1e-77aa-4c2d-9f01-8b6e5d4a3c21")
        UUID ticketKey,

        @Schema(description = "티켓 가격(원)", example = "88000")
        int totalAmount,

        @Schema(description = "캣머니로 차감된 금액", example = "11401")
        int tokenAmount,

        @Schema(description = "카드로 결제된 금액", example = "76599")
        int cashAmount,

        @Schema(description = """
                NFT 티켓 발행 상태.
                - `PENDING` / `MINTING` : 발행 요청 후 체인 확정을 기다리는 중입니다 (정상 구간)
                - `MINTED` : 체인에 올라갔습니다
                - `FAILED` : 발행이 실패했습니다. 예매 자체는 유효합니다
                """, example = "PENDING")
        String nftStatus,

        @Schema(description = "결제 완료 시각", example = "2026-09-08T18:31:22")
        LocalDateTime paidAt
) {

    /**
     * @param nftTicket 아직 발행 대상이 만들어지지 않았으면 null (결제 직후 짧은 구간)
     */
    public static TicketOrderResponse of(TicketOrder order, NftTicket nftTicket) {
        return new TicketOrderResponse(
                order.getId(),
                order.getTicket() == null ? null : order.getTicket().getId(),
                nftTicket == null ? null : nftTicket.getTicketKey(),
                order.getTotalAmount(),
                order.getTokenAmount(),
                order.getCashAmount(),
                nftTicket == null || nftTicket.getStatus() == null
                        ? null : nftTicket.getStatus().name(),
                order.getPaidAt());
    }
}
