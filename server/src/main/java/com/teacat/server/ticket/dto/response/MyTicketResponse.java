package com.teacat.server.ticket.dto.response;

import com.teacat.server.nft.entity.NftTicket;
import com.teacat.server.payment.entity.TicketOrder;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.ticket.entity.Ticket;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 내 티켓 한 장.
 *
 * <p>티켓은 "무엇을 보러 가는가" 를 답하고, 주문은 "얼마를 어떻게 냈는가" 를 답합니다. 원래는
 * 그래서 금액을 빼 두었지만, <b>내 티켓 화면이 그 둘을 한 카드에 보여줍니다.</b> 화면이 티켓과
 * 주문을 각각 부르게 하면 목록 한 번에 N+1 호출이 나고 로딩이 두 번 깜빡입니다. 그래서 주문의
 * 두 값만({@code ticketOrderId}, {@code totalAmount}) 여기 함께 실어 보냅니다.
 *
 * <p>{@code ticketOrderId} 는 표시용이 아니라 <b>취소에 필요합니다.</b> 취소는 티켓이 아니라
 * 주문 단위입니다 — {@code POST /payments/ticket-orders/{ticketOrderId}/cancel}.
 */
@Schema(description = "내 티켓")
public record MyTicketResponse(

        @Schema(description = "티켓 ID", example = "1")
        Long ticketId,

        @Schema(description = "예매 상태. CANCELLED 면 취소된 예매입니다.", example = "CONFIRMED")
        String status,

        @Schema(description = "공연명", example = "테아캣 단독 콘서트")
        String title,

        @Schema(description = "포스터 주소. 유효시간이 있는 임시 URL 입니다.")
        String posterUrl,

        @Schema(description = "회차 번호", example = "1")
        int performanceNum,

        @Schema(description = "공연 일시", example = "2026-10-08T19:00:00")
        LocalDateTime performanceDate,

        @Schema(description = "공연장 이름", example = "올림픽공원 체조경기장")
        String stadiumName,

        @Schema(description = "공연장 주소", example = "서울 송파구 올림픽로 424")
        String stadiumAddress,

        @Schema(description = "구역 코드", example = "A")
        String areaCode,

        @Schema(description = "열. 스탠딩이면 생략됩니다.", example = "3")
        String rowLabel,

        @Schema(description = "좌석 번호. 스탠딩이면 생략됩니다.", example = "12")
        Integer seatNumber,

        @Schema(description = """
                NFT 티켓 발행 상태. 예매 자체와는 다른 축입니다 —
                발행이 `PENDING`/`MINTING`/`FAILED` 여도 **예매는 유효합니다.**
                - `PENDING` / `MINTING` : 체인 확정을 기다리는 중
                - `MINTED` : 체인에 올라감
                - `BURNED` : 예매 취소로 소각됨
                - `FAILED` : 발행 실패 (서버가 재시도합니다)
                """, example = "MINTED")
        String nftStatus,

        @Schema(description = "온체인 토큰 번호. 발행 확정 전에는 생략됩니다.")
        String tokenId,

        @Schema(description = "예매 시각", example = "2026-09-08T17:17:01")
        LocalDateTime bookedAt,

        @Schema(description = """
                주문 ID. **예매 취소에 쓰는 값입니다** — 취소는 티켓이 아니라 주문 단위입니다.
                주문을 못 찾으면 생략되고, 그때는 취소 버튼을 보여주지 마세요.
                """, example = "31")
        Long ticketOrderId,

        @Schema(description = "결제한 티켓 가격(원). 주문을 못 찾으면 생략됩니다.", example = "88000")
        Integer totalAmount
) {

    /**
     * @param nftTicket 발행 대상이 아직 안 만들어졌으면 null (결제 직후 짧은 구간)
     * @param order     발권한 주문. 못 찾으면 null — 금액과 취소 버튼이 빠진다
     * @param posterUrl 발급된 임시 URL. 키가 없으면 null
     */
    public static MyTicketResponse of(Ticket ticket, NftTicket nftTicket,
            TicketOrder order, String posterUrl) {
        PerformanceDetail detail = ticket.getPerformanceDetail();
        PerformanceGeneral performance = detail.getPerformance();

        return new MyTicketResponse(
                ticket.getId(),
                ticket.getStatus().name(),
                performance.getTitle(),
                posterUrl,
                detail.getPerformanceNum(),
                detail.getPerformanceDate(),
                performance.getStadium().getName(),
                performance.getStadium().getAddress(),
                ticket.getArea().getAreaCode(),
                ticket.getSeat() == null ? null : ticket.getSeat().getRowLabel(),
                ticket.getSeat() == null ? null : ticket.getSeat().getSeatNumber(),
                nftTicket == null || nftTicket.getStatus() == null ? null : nftTicket.getStatus().name(),
                nftTicket == null || nftTicket.getTokenId() == null
                        ? null : nftTicket.getTokenId().toString(),
                ticket.getBookedAt(),
                order == null ? null : order.getId(),
                order == null ? null : order.getTotalAmount());
    }
}
