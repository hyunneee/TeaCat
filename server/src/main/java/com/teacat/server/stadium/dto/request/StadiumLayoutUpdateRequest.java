package com.teacat.server.stadium.dto.request;

import com.teacat.server.stadium.entity.StadiumLayoutStatus;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record StadiumLayoutUpdateRequest(
        @Size(min = 1, max = 100) String name,
        Boolean isDefault,
        StadiumLayoutStatus status,
        List<Map<String, Object>> layoutElements
) {
    public boolean isEmpty() {
        return name == null && isDefault == null && status == null && layoutElements == null;
    }
}
