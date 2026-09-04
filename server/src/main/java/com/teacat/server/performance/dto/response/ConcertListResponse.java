package com.teacat.server.performance.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 커서 기반 목록 응답 (API-201).
 *
 * 다음 페이지는 nextCursor 를 그대로 cursor 파라미터에 넣어 요청한다.
 */
@Schema(description = "공연 목록 응답")
public record ConcertListResponse(

        @Schema(description = "공연 목록")
        List<ConcertSummaryResponse> concerts,

        @Schema(description = "다음 페이지 커서. 마지막 페이지면 null", example = "12")
        Long nextCursor,

        @Schema(description = "다음 페이지 존재 여부", example = "true")
        boolean hasNext
) {

    public static ConcertListResponse of(List<ConcertSummaryResponse> concerts, Long nextCursor, boolean hasNext) {
        return new ConcertListResponse(concerts, nextCursor, hasNext);
    }
}
