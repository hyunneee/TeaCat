package com.teacat.server.booking.dto.response;

import com.teacat.server.booking.entity.SeatBookingStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

@Schema(description = "좌석 선점 결과")
public record SeatHoldResponse(

        @Schema(description = "공연 회차 ID", example = "45")
        Long performanceDetailId,

        @Schema(description = "선점한 좌석 ID", example = "1024")
        Long seatId,

        @Schema(description = "좌석 상태", example = "HELD")
        SeatBookingStatus status,

        @Schema(description = "선점 만료 시각. 이 시각까지 결제하지 않으면 자동 해제됩니다.",
                example = "2026-09-02T14:32:10")
        LocalDateTime heldUntil,

        @Schema(description = "선점 만료까지 남은 시간(초)", example = "600")
        long remainingSeconds
) {
}
