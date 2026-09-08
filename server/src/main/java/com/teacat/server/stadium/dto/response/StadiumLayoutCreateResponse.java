package com.teacat.server.stadium.dto.response;

import java.util.List;

public record StadiumLayoutCreateResponse(
        Long layoutId,
        Long stadiumId,
        int createdAreaCount,
        int createdSeatCount,
        List<CreatedLayoutAreaResponse> areas
) {
}
