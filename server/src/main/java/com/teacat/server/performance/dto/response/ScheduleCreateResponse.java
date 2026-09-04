package com.teacat.server.performance.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "회차 등록 응답")
public record ScheduleCreateResponse(

        @Schema(description = "생성된 회차 ID", example = "1")
        Long scheduleId,

        @Schema(description = "부여된 회차 번호", example = "1")
        int performanceNum
) {

    public static ScheduleCreateResponse of(Long scheduleId, int performanceNum) {
        return new ScheduleCreateResponse(scheduleId, performanceNum);
    }
}
