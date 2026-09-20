package com.teacat.server.performance.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 예매자 명단 한 페이지.
 *
 * <p>🔴 <b>커서 페이지다.</b> 명단은 검표가 진행되는 동안 계속 바뀌므로 offset 으로 넘기면
 * 앞 페이지의 줄이 밀려 다음 페이지에서 같은 줄이 또 나오거나 건너뛴다. 커서는 티켓 번호
 * 내림차순 기준이라 검표가 진행돼도 경계가 움직이지 않는다.
 */
@Schema(description = "예매자 명단 페이지")
public record OperationsAttendeePageResponse(

        @Schema(description = "명단")
        List<OperationsAttendeeResponse> items,

        @Schema(description = "다음 페이지 커서. 마지막 페이지면 null", example = "1024")
        String nextCursor,

        @Schema(description = "다음 페이지가 있는지", example = "true")
        boolean hasNext,

        @Schema(description = "필터를 적용한 전체 명단 수", example = "320")
        long totalCount
) {
}
