package com.teacat.server.performance.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

/**
 * 회차 등록 요청 (API-265).
 *
 * 회차 번호를 생략하면 등록 뒤 그 공연의 회차 번호가 일시 순으로 다시 매겨진다.
 * 번호를 직접 지정하면 그대로 쓴다.
 */
@Schema(description = "회차 등록 요청")
public record ScheduleCreateRequest(

        @Schema(description = "공연 일시 (시작 시각까지)", example = "2026-11-14T19:00:00")
        @NotNull(message = "공연 일시를 입력해 주세요.")
        LocalDateTime performanceDate,

        @Schema(description = "회차 번호. 생략하면 일시 순으로 전체 번호가 다시 매겨진다", example = "1")
        @Min(value = 1, message = "회차 번호는 1 이상이어야 합니다.")
        Integer performanceNum
) {
}
