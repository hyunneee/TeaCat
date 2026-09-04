package com.teacat.server.performance.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

/**
 * 회차 등록 요청 (API-265).
 *
 * 회차 번호를 생략하면 기존 마지막 번호 + 1 로 자동 부여한다.
 */
@Schema(description = "회차 등록 요청")
public record ScheduleCreateRequest(

        @Schema(description = "공연 일시 (시작 시각까지)", example = "2026-11-14T19:00:00")
        @NotNull(message = "공연 일시를 입력해 주세요.")
        LocalDateTime performanceDate,

        @Schema(description = "회차 번호. 생략하면 자동으로 다음 번호가 붙는다", example = "1")
        @Min(value = 1, message = "회차 번호는 1 이상이어야 합니다.")
        Integer performanceNum
) {
}
