package com.teacat.server.performance.dto.response;

import com.teacat.server.performance.entity.BookingOpenStatus;
import com.teacat.server.performance.entity.PerformanceGeneral;
import com.teacat.server.performance.entity.PerformanceStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "공연 목록 항목")
public record ConcertSummaryResponse(

        @Schema(description = "공연 ID", example = "1")
        Long concertId,

        @Schema(description = "공연 제목", example = "티캣 단독 콘서트 2026")
        String title,

        @Schema(description = "공연장 이름", example = "올림픽공원 체조경기장")
        String stadiumName,

        @Schema(description = "티켓팅 오픈 시각")
        LocalDateTime ticketingStartAt,

        @Schema(description = "공연 상태", example = "UPCOMING")
        PerformanceStatus status,

        @Schema(description = """
                이 공연의 **대표 예매 상태**. 회차들을 합쳐 서버가 계산한 값이다
                (하나라도 열려 있으면 OPEN → 곧 열림 BEFORE → 매진 SOLDOUT → 마감 CLOSED).

                🔴 목록 칩은 반드시 이 값을 써야 한다. `ticketingStartAt` 과 현재 시각만
                비교하면 회차가 전부 마감이거나 공연이 지난 공연도 "예매중" 으로 보인다.
                """, example = "OPEN")
        BookingOpenStatus bookingStatus,

        @Schema(description = "포스터 조회 URL. 유효시간이 지나면 만료되므로 저장하지 말 것")
        String posterUrl,

        @Schema(description = "비공개 상태인가. 클라이언트 목록에서는 항상 false 다(비공개는 목록에서 빠짐). "
                + "등록자용 목록(/admin/concerts/mine)에서만 true 가 올 수 있다", example = "false")
        boolean hidden
) {

    public static ConcertSummaryResponse of(PerformanceGeneral performance, String posterUrl,
            BookingOpenStatus bookingStatus) {
        return new ConcertSummaryResponse(
                performance.getId(),
                performance.getTitle(),
                performance.getStadium().getName(),
                performance.getTicketingStartAt(),
                performance.getStatus(),
                bookingStatus,
                posterUrl,
                performance.isHidden()
        );
    }
}
