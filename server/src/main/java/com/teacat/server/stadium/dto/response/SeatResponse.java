package com.teacat.server.stadium.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "좌석 정보")
public record SeatResponse(
        @Schema(description = "좌석 ID", example = "1001") Long seatId,
        @Schema(description = "좌석 열", example = "A") String rowLabel,
        @Schema(description = "좌석 번호", example = "1") int seatNumber,
        @Schema(description = "좌석 X 좌표", example = "10") BigDecimal seatX,
        @Schema(description = "좌석 Y 좌표", example = "20") BigDecimal seatY
) {
}
