package com.teacat.server.stadium.dto.response;

import java.util.List;

public record StadiumLayoutListResponse(Long stadiumId, List<StadiumLayoutSummaryResponse> layouts) {
}
