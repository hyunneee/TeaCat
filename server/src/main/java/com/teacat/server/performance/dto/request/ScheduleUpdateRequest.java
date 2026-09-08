package com.teacat.server.performance.dto.request;

import com.teacat.server.performance.entity.TicketingStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * 회차 수정 요청 (API-266).
 *
 * 보내지 않은(null) 필드는 그대로 둔다.
 */
@Schema(description = "회차 수정 요청. 바꿀 필드만 보내면 된다")
public record ScheduleUpdateRequest(

        @Schema(description = "공연 일시", example = "2026-12-25T19:30:00")
        LocalDateTime performanceDate,

        @Schema(description = "회차 판매 상태", example = "OPEN")
        TicketingStatus status
) {

    public boolean isEmpty() {
        return performanceDate == null && status == null;
    }
}
