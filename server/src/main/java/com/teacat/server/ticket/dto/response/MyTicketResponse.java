package com.teacat.server.ticket.dto.response;

import com.teacat.server.nft.entity.NftTicket;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.ticket.entity.Ticket;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 내 티켓 한 장.
 *
 * <p>결제 금액은 여기 없습니다 — 주문에 속한 정보라 {@code GET /payments/ticket-orders/{id}} 에
 * 있습니다. 티켓은 "무엇을 보러 가는가" 만 답합니다. 대신 그 주문으로 가는 열쇠
 * ({@code ticketOrderId})는 함께 줍니다 — 금액 조회도 <b>예매 취소</b>도 주문에 걸려 있어서,
 * 이게 없으면 티켓 화면에서 취소 버튼을 걸 방법이 없습니다.
 */
@Schema(description = "내 티켓")
public record MyTicketResponse(

        @Schema(description = "티켓 ID", example = "1")
        Long ticketId,

        @Schema(description = """
                이 티켓을 만든 주문 ID. 결제 금액 조회(`GET /payments/ticket-orders/{id}`)와
                예매 취소(`POST /payments/ticket-orders/{id}/cancel`)에 씁니다.
                """, example = "31")
        Long ticketOrderId,

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

        @Schema(description = "공연장 이름", example = "테아캣 아레나")
        String stadiumName,

        @Schema(description = "공연장 주소", example = "서울 송파구 올림픽로 25")
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
        LocalDateTime bookedAt
) {

    /**
     * @param ticketOrderId 이 티켓의 주문. 결제를 거치지 않고 만들어진 티켓이면 null
     * @param nftTicket     발행 대상이 아직 안 만들어졌으면 null (결제 직후 짧은 구간)
     * @param posterUrl     발급된 임시 URL. 키가 없으면 null
     */
    public static MyTicketResponse of(Ticket ticket, Long ticketOrderId, NftTicket nftTicket,
            String posterUrl) {
        PerformanceDetail detail = ticket.getPerformanceDetail();

        return new MyTicketResponse(
                ticket.getId(),
                ticketOrderId,
                ticket.getStatus().name(),
                detail.getPerformance().getTitle(),
                posterUrl,
                detail.getPerformanceNum(),
                detail.getPerformanceDate(),
                detail.getPerformance().getStadium().getName(),
                detail.getPerformance().getStadium().getAddress(),
                ticket.getArea().getAreaCode(),
                ticket.getSeat() == null ? null : ticket.getSeat().getRowLabel(),
                ticket.getSeat() == null ? null : ticket.getSeat().getSeatNumber(),
                nftTicket == null || nftTicket.getStatus() == null ? null : nftTicket.getStatus().name(),
                nftTicket == null || nftTicket.getTokenId() == null
                        ? null : nftTicket.getTokenId().toString(),
                ticket.getBookedAt());
    }
}
