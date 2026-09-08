package com.teacat.server.stadium.dto.request;

import com.teacat.server.stadium.entity.AreaType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

@Schema(description = "구역과 초기 좌석 생성 정보")
public record AreaCreateRequest(
        @Schema(description = "구역 코드", example = "A")
        @NotBlank @Size(max = 20) String areaCode,

        @Schema(description = "층 코드", example = "2F")
        @Size(max = 20) String levelCode,

        @Schema(description = "구역 유형", example = "SEATED")
        @NotNull AreaType type,

        @Schema(description = "구역 최대 수용 인원", example = "100")
        @NotNull @Positive Integer maxSeat,

        @Schema(description = "구역 X 좌표", example = "10")
        @DecimalMin("0") BigDecimal areaX,

        @Schema(description = "구역 Y 좌표", example = "20")
        @DecimalMin("0") BigDecimal areaY,

        @Schema(description = "구역 너비", example = "300")
        @DecimalMin(value = "0", inclusive = false) BigDecimal width,

        @Schema(description = "구역 높이", example = "200")
        @DecimalMin(value = "0", inclusive = false) BigDecimal height,

        @Schema(description = "함께 생성할 초기 좌석 목록")
        List<@Valid SeatCreateRequest> seats
) {
    public AreaCreateRequest(String areaCode, AreaType type, Integer maxSeat,
                             BigDecimal areaX, BigDecimal areaY, BigDecimal width,
                             BigDecimal height, List<SeatCreateRequest> seats) {
        this(areaCode, "1F", type, maxSeat, areaX, areaY, width, height, seats);
    }

    public String levelCodeOrDefault() {
        return levelCode == null || levelCode.isBlank() ? "1F" : levelCode.strip();
    }

    public List<SeatCreateRequest> seatsOrEmpty() {
        return seats == null ? List.of() : seats;
    }
}
