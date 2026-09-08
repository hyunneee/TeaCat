package com.teacat.server.stadium.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record LayoutBoundsRequest(
        @NotNull @DecimalMin("0") BigDecimal x,
        @NotNull @DecimalMin("0") BigDecimal y,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal width,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal height
) {
}
