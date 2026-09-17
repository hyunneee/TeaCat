package com.teacat.server.queue.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "대기실 운영 현황 (관리자)")
public record QueueAdminStatusResponse(
        @Schema(description = "회차 ID", example = "30")
        Long scheduleId,

        @Schema(description = "대기실 운영 중인지", example = "true")
        boolean enabled,

        @Schema(description = "대기 인원", example = "12340")
        long waiting,

        @Schema(description = "지금 좌석 페이지에 들어가 있는 인원", example = "4998")
        long admitted,

        @Schema(description = "적용 중인 정원. override 가 있으면 그 값", example = "5000")
        int capacity,

        @Schema(description = "회차별 override 정원. 없으면 null (환경변수 값 적용)", example = "3000")
        Integer capacityOverride,

        @Schema(description = "적용 중인 초당 입장 상한", example = "200")
        int maxPerTick,

        @Schema(description = "회차별 override. 없으면 null")
        Integer maxPerTickOverride,

        @Schema(description = "적용 중인 무활동 이탈 초", example = "600")
        int ttlSec,

        @Schema(description = "회차별 override. 없으면 null")
        Integer ttlSecOverride,

        @Schema(description = "최근 60초 평균 입장 속도 (명/초)", example = "83.3")
        double admitPerSec
) {
}
