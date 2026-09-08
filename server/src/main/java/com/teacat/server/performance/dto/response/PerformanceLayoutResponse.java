package com.teacat.server.performance.dto.response;

import java.util.List;
import java.util.Map;

public record PerformanceLayoutResponse(
        Long performanceId,
        Long stadiumId,
        Long stadiumLayoutId,
        String stadiumLayoutName,
        String layoutImageUrl,
        int layoutWidth,
        int layoutHeight,
        List<Map<String, Object>> baseElements,
        List<Map<String, Object>> elements,
        List<Long> blockedSeatIds
) {
}
