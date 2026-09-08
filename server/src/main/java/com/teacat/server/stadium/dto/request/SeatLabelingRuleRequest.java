package com.teacat.server.stadium.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record SeatLabelingRuleRequest(
        String rowOrder,
        String rowFormat,
        @Size(max = 8) String startRowLabel,
        String seatOrder,
        @Min(1) Integer startNumber
) {
    public int startNumberOrDefault() {
        return startNumber == null ? 1 : startNumber;
    }
}
