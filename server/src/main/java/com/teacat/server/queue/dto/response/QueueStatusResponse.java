package com.teacat.server.queue.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 대기실 상태 응답. 대기실 화면이 이 값으로 "앞에 N명" 을 그리고, {@code admitted} 가 true 가 되면 좌석 페이지로 넘어간다.
 *
 * <p>대기실이 꺼진 회차는 {@code enabled=false, admitted=true} 다. 프론트는 대기실을 건너뛴다.
 */
@Schema(description = "대기실 상태 응답")
public record QueueStatusResponse(
        @Schema(description = "회차 ID", example = "30")
        Long scheduleId,

        @Schema(description = "이 회차가 대기실을 운영 중인지. false 면 admitted 는 항상 true", example = "true")
        boolean enabled,

        @Schema(description = "좌석 페이지에 들어갈 수 있는지", example = "false")
        boolean admitted,

        @Schema(description = "내 순번(1부터). 입장했거나 대기실이 꺼져 있으면 null", example = "12340")
        Integer position,

        @Schema(description = "내 앞에 있는 인원", example = "12339")
        Integer waitingAhead,

        @Schema(description = "예상 대기 초. 최근 60초 입장 속도로 계산. 속도가 0 이면 null", example = "62")
        Integer estimatedWaitSec,

        @Schema(description = "적용 중인 정원", example = "5000")
        int capacity,

        @Schema(description = "다음 상태 조회까지 기다릴 초. 대기 인원이 많으면 늘어난다", example = "5")
        int pollAfterSec
) {
    public static QueueStatusResponse disabled(Long scheduleId, int capacity) {
        return new QueueStatusResponse(scheduleId, false, true, null, null, null, capacity, 0);
    }

    public static QueueStatusResponse admitted(Long scheduleId, int capacity) {
        return new QueueStatusResponse(scheduleId, true, true, null, null, null, capacity, 0);
    }
}
