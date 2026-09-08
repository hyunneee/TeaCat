package com.teacat.server.performance.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.Map;

public record PerformanceLayoutUpdateRequest(
        @NotNull @Positive Long stadiumLayoutId,
        List<Map<String, Object>> elements,
        List<@Positive Long> blockedSeatIds
) {
    public List<Map<String, Object>> elementsOrEmpty() {
        return elements == null ? List.of() : elements;
    }

    public List<Long> blockedSeatIdsOrEmpty() {
        return blockedSeatIds == null ? List.of() : blockedSeatIds;
    }
}
