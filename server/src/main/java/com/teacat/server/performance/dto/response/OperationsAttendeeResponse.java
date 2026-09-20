package com.teacat.server.performance.dto.response;

import com.teacat.server.ticket.entity.TicketStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 예매자 명단 한 줄. <b>티켓 한 장이 한 줄</b>이다.
 *
 * <p>주문 하나로 좌석 여러 장을 살 수 있으므로 주문 단위로 묶으면 좌석과 1:1 로 이어지지
 * 않는다. 좌석맵에서 좌석을 눌렀을 때 이 줄로 곧장 이어져야 한다.
 *
 * <p>🔴 이름·연락처는 <b>서버가 가려서</b> 내려보낸다 ({@code AttendeeMasking}).
 */
@Schema(description = "예매자 명단 한 줄 (개인정보 마스킹)")
public record OperationsAttendeeResponse(

        @Schema(description = "티켓 번호", example = "1024")
        Long ticketId,

        @Schema(description = "구역 ID", example = "7")
        Long areaId,

        @Schema(description = "구역 코드", example = "A")
        String areaCode,

        @Schema(description = "좌석 ID. 스탠딩이면 null", example = "5001")
        Long seatId,

        @Schema(description = "열. 스탠딩이면 null", example = "3")
        String rowLabel,

        @Schema(description = "좌석 번호. 스탠딩이면 null", example = "12")
        Integer seatNumber,

        @Schema(description = "예매자 이름(마스킹)", example = "홍*동")
        String holderName,

        @Schema(description = "예매자 닉네임. 서비스에서 공개되는 표시 이름이라 가리지 않는다", example = "고양이집사")
        String holderNickname,

        @Schema(description = "예매자 연락처(마스킹)", example = "010-****-5678")
        String holderPhone,

        @Schema(description = "예매 상태", example = "CONFIRMED")
        TicketStatus status,

        @Schema(description = "예매 시각")
        LocalDateTime bookedAt,

        @Schema(description = "입장 시각. 아직이면 null")
        LocalDateTime checkedInAt
) {
}
