package com.teacat.server.gate.dto.response;

import com.teacat.server.gate.repository.GateTicketRepository.TicketSummaryProjection;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 판정이 붙은 티켓 — 운영자가 눈앞의 사람과 맞춰 보는 데 필요한 만큼만.
 *
 * <p>🔴 <b>{@code NO_MATCH} 에는 실려 나가지 않는다.</b> 안 닮았는데도 "가장 가까웠던 사람"
 * 정보를 돌려주면, 남의 얼굴로 여러 번 찍으며 그 회차에 누가 오는지 훑어볼 수 있다.
 */
@Schema(description = "검표로 찾은 티켓")
public record GateTicketResponse(

        @Schema(description = "티켓 ID. 수동 통과·입장 취소에 쓰는 값입니다.", example = "8812")
        Long ticketId,

        @Schema(description = "예매자 이름", example = "김테아")
        String userName,

        @Schema(description = "구역 코드", example = "A")
        String areaCode,

        @Schema(description = "열. 스탠딩이면 생략됩니다.", example = "3")
        String rowLabel,

        @Schema(description = "좌석 번호. 스탠딩이면 생략됩니다.", example = "12")
        Integer seatNumber
) {

    public static GateTicketResponse from(TicketSummaryProjection summary) {
        return new GateTicketResponse(
                summary.getTicketId(),
                summary.getUserName(),
                summary.getAreaCode(),
                summary.getRowLabel(),
                summary.getSeatNumber());
    }
}
