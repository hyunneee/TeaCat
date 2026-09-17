package com.teacat.server.queue.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 대기실 켜기/끄기 + 회차별 override.
 *
 * <p>정원·틱 상한·TTL 은 평소 환경변수 값을 쓴다. 여기 값을 보내면 그 회차만 덮어쓰고,
 * null 로 보내면 override 를 지워 환경변수 값으로 돌아간다.
 */
@Schema(description = "대기실 설정 요청")
public record QueueConfigRequest(
        @Schema(description = "대기실 켜기/끄기", example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull Boolean enabled,

        @Schema(description = "이 회차만의 정원. 비우면 환경변수(QUEUE_CAPACITY) 값", example = "3000")
        @Positive Integer capacity,

        @Schema(description = "이 회차만의 초당 입장 상한. 비우면 환경변수 값", example = "100")
        @Positive Integer maxPerTick,

        @Schema(description = "이 회차만의 무활동 이탈 초. 비우면 환경변수 값", example = "900")
        @Positive Integer ttlSec
) {
}
