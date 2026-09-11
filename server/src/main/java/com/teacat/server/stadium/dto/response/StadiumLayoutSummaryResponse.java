package com.teacat.server.stadium.dto.response;

import com.teacat.server.stadium.entity.StadiumLayoutStatus;

public record StadiumLayoutSummaryResponse(
        Long layoutId,
        String name,
        boolean isDefault,
        StadiumLayoutStatus status,
        int layoutWidth,
        int layoutHeight,
        long areaCount,
        long seatCount,
        long standingCapacity,
        long capacity
) {
}
