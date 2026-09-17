package com.teacat.server.ticket.dto.response;

import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.ticket.entity.Ticket;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 게이트가 QR 을 찍은 직후 보는 화면 — <b>이 표가 맞는가</b>.
 *
 * <p>얼굴을 찍기 전에 사람이 먼저 눈으로 확인하는 단계다. 회차가 맞는지, 이미 들어온 표는
 * 아닌지, 대조할 얼굴이 있는지를 여기서 알려준다.
 *
 * <p>🔴 <b>임베딩은 나가지 않는다.</b> 나가는 것은 "대조할 수 있는가"({@code faceVerifiable})
 * 라는 판정 하나뿐이다.
 */
@Schema(description = "입장 확인 - 티켓 정보")
public record CheckInTicketResponse(

        @Schema(description = "티켓 번호", example = "1")
        Long ticketId,

        @Schema(description = "예매자 표시 이름", example = "고양이집사")
        String holderNickname,

        @Schema(description = "공연명", example = "테아캣 단독 콘서트")
        String title,

        @Schema(description = "회차 번호", example = "1")
        int performanceNum,

        @Schema(description = "공연 일시", example = "2026-10-08T19:00:00")
        LocalDateTime performanceDate,

        @Schema(description = "구역 코드", example = "A")
        String areaCode,

        @Schema(description = "열. 스탠딩이면 생략됩니다.", example = "3")
        String rowLabel,

        @Schema(description = "좌석 번호. 스탠딩이면 생략됩니다.", example = "12")
        Integer seatNumber,

        @Schema(description = "이미 입장한 시각. 아직이면 생략됩니다.")
        LocalDateTime checkedInAt,

        @Schema(description = """
                얼굴 대조가 가능한가. false 면 이 티켓은 얼굴로 본인 확인을 할 수 없습니다 —
                예매 당시 얼굴을 등록하지 않았거나(가입 시 채워 둔 기본 얼굴), 탈퇴로 파기된 경우입니다.
                """, example = "true")
        boolean faceVerifiable
) {

    public static CheckInTicketResponse from(Ticket ticket) {
        PerformanceDetail detail = ticket.getPerformanceDetail();

        return new CheckInTicketResponse(
                ticket.getId(),
                ticket.getUser().getNickname(),
                detail.getPerformance().getTitle(),
                detail.getPerformanceNum(),
                detail.getPerformanceDate(),
                ticket.getArea().getAreaCode(),
                ticket.getSeat() == null ? null : ticket.getSeat().getRowLabel(),
                ticket.getSeat() == null ? null : ticket.getSeat().getSeatNumber(),
                ticket.getCheckedInAt(),
                ticket.canVerifyFace());
    }
}
