package com.teacat.server.resale.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

@Schema(description = "취소표 대기 신청")
public record ApplyResaleRequest(
        @Schema(description = "구역(area) ID", example = "12")
        @NotNull Long sectionId,
        @Schema(description = "신청 매수. 1인 최대 예매 매수(booking.policy.max-tickets-per-user)까지", example = "1")
        @Min(1) int quantity
) {
}
