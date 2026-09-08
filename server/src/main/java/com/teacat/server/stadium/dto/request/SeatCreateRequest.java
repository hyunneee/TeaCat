package com.teacat.server.stadium.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

@Schema(description = "좌석 생성 정보")
public record SeatCreateRequest(
        @Schema(description = "좌석 열", example = "A")
        @NotBlank @Size(max = 10) String rowLabel,

        @Schema(description = "좌석 번호", example = "1")
        @NotNull @Positive Integer seatNumber,

        @Schema(description = "좌석 X 좌표", example = "10")
        @DecimalMin("0") BigDecimal seatX,

        @Schema(description = "좌석 Y 좌표", example = "20")
        @DecimalMin("0") BigDecimal seatY
) {
}
