package com.teacat.server.performance.dto.response;

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

        @Schema(description = "포스터 조회 URL. 유효시간이 지나면 만료되므로 저장하지 말 것")
        String posterUrl,

        @Schema(description = "비공개 상태인가. 클라이언트 목록에서는 항상 false 다(비공개는 목록에서 빠짐). "
                + "등록자용 목록(/admin/concerts/mine)에서만 true 가 올 수 있다", example = "false")
        boolean hidden
) {

    public static ConcertSummaryResponse of(PerformanceGeneral performance, String posterUrl) {
        return new ConcertSummaryResponse(
                performance.getId(),
                performance.getTitle(),
                performance.getStadium().getName(),
                performance.getTicketingStartAt(),
                performance.getStatus(),
                posterUrl,
                performance.isHidden()
        );
    }
}
