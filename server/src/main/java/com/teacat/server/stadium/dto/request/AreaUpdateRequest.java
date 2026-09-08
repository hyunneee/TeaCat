package com.teacat.server.stadium.dto.request;

import com.teacat.server.stadium.entity.AreaType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

@Schema(description = "구역 수정 요청")
public record AreaUpdateRequest(
        @Schema(description = "구역 코드", example = "A1")
        @Pattern(regexp = ".*\\S.*", message = "구역 코드는 공백일 수 없습니다.")
        @Size(max = 20) String areaCode,

        @Schema(description = "구역 유형", example = "SEATED")
        AreaType type,

        @Schema(description = "구역 최대 수용 인원", example = "120")
        @Positive Integer maxSeat,

        @Schema(description = "구역 X 좌표", example = "15")
        @DecimalMin("0") BigDecimal areaX,

        @Schema(description = "구역 Y 좌표", example = "20")
        @DecimalMin("0") BigDecimal areaY,

        @Schema(description = "구역 너비", example = "320")
        @DecimalMin(value = "0", inclusive = false) BigDecimal width,

        @Schema(description = "구역 높이", example = "200")
        @DecimalMin(value = "0", inclusive = false) BigDecimal height
) {
    public boolean isEmpty() {
        return areaCode == null && type == null && maxSeat == null && areaX == null
                && areaY == null && width == null && height == null;
    }

    public boolean changesStructure() {
        return areaCode != null || type != null || maxSeat != null;
    }
}
