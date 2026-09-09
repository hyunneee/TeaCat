package com.teacat.server.booking.dto.response;

import com.teacat.server.booking.entity.SeatBookingStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

/**
 * 좌석맵의 좌석 한 칸.
 *
 * 🔴 누가 선점했는지(held_by)는 절대 넣지 않는다. 좌석맵은 비로그인도 볼 수 있고,
 *    넣는 순간 "누가 어느 자리를 잡았는지" 가 공개된다.
 */
@Schema(description = "좌석맵 좌석")
public record SeatStatusResponse(

        @Schema(description = "좌석 ID", example = "1024")
        Long seatId,

        @Schema(description = "좌석 열", example = "A")
        String rowLabel,

        @Schema(description = "좌석 번호", example = "1")
        int seatNumber,

        @Schema(description = "좌석 X 좌표 (공연장 도면 좌표계)", example = "178.55")
        BigDecimal seatX,

        @Schema(description = "좌석 Y 좌표", example = "194.665")
        BigDecimal seatY,

        @Schema(description = "예매 상태", example = "AVAILABLE")
        SeatBookingStatus status
) {
}
