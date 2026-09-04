package com.teacat.server.performance.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "공연 등록 응답")
public record ConcertCreateResponse(

        @Schema(description = "생성된 공연 ID", example = "1")
        Long concertId
) {

    public static ConcertCreateResponse of(Long concertId) {
        return new ConcertCreateResponse(concertId);
    }
}
