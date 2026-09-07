package com.teacat.server.performance.dto.request;

import com.teacat.server.performance.entity.PerformanceStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * 공연 상태 전환 요청 (API-264).
 */
@Schema(description = "공연 상태 전환 요청")
public record ConcertStatusRequest(

        @Schema(description = "바꿀 상태. UPCOMING → ONGOING → ENDED 순서로만 나아가며, "
                + "UPCOMING·ONGOING 은 CANCELLED 로 바꿀 수 있다. ENDED·CANCELLED 는 되돌릴 수 없다",
                example = "ONGOING")
        @NotNull(message = "바꿀 상태를 지정해 주세요.")
        PerformanceStatus status
) {
}
