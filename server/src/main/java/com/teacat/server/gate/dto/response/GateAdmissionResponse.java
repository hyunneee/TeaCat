package com.teacat.server.gate.dto.response;

import com.teacat.server.gate.entity.Admission;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/** 수동 통과 결과 */
@Schema(description = "입장 기록")
public record GateAdmissionResponse(

        @Schema(description = "티켓 ID", example = "8812")
        Long ticketId,

        @Schema(description = "입장 시각", example = "2026-10-08T18:31:04")
        LocalDateTime admittedAt,

        @Schema(description = "어떻게 통과시켰는가. `FACE` 는 얼굴 대조, `MANUAL` 은 운영자 확인입니다.",
                example = "MANUAL")
        String method
) {

    public static GateAdmissionResponse from(Admission admission) {
        return new GateAdmissionResponse(
                admission.getTicketId(),
                admission.getAdmittedAt(),
                admission.getMethod().name());
    }
}
