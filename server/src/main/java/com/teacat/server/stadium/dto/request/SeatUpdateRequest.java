package com.teacat.server.stadium.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

@Schema(description = "좌석 수정 요청")
public record SeatUpdateRequest(
        @Schema(description = "좌석 열", example = "B")
        @Pattern(regexp = ".*\\S.*", message = "좌석 열은 공백일 수 없습니다.")
        @Size(max = 10) String rowLabel,

        @Schema(description = "좌석 번호", example = "3")
        @Positive Integer seatNumber,

        @Schema(description = "좌석 X 좌표", example = "50")
        @DecimalMin("0") BigDecimal seatX,

        @Schema(description = "좌석 Y 좌표", example = "40")
        @DecimalMin("0") BigDecimal seatY
) {
    public boolean isEmpty() {
        return rowLabel == null && seatNumber == null && seatX == null && seatY == null;
    }
}
