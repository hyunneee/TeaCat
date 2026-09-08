package com.teacat.server.stadium.dto.response;

import java.util.List;

public record CreatedLayoutAreaResponse(Long areaId, String areaCode, List<CreatedSeatResponse> seats) {
}
