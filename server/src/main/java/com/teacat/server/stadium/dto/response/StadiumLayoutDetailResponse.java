package com.teacat.server.stadium.dto.response;

import com.teacat.server.stadium.entity.StadiumLayoutStatus;

import java.util.List;
import java.util.Map;

public record StadiumLayoutDetailResponse(
        Long layoutId,
        Long stadiumId,
        String stadiumName,
        String name,
        boolean isDefault,
        StadiumLayoutStatus status,
        String layoutImageUrl,
        int layoutWidth,
        int layoutHeight,
        List<Map<String, Object>> layoutElements,
        long areaCount,
        long seatCount,
        long standingCapacity,
        long capacity
) {
}
