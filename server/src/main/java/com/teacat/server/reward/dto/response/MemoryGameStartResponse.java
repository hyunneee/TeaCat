package com.teacat.server.reward.dto.response;

import com.teacat.server.reward.entity.MemoryGameSession;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "짝 맞추기 시작")
public record MemoryGameStartResponse(
        @Schema(description = "이 판의 ID. 클리어할 때 그대로 돌려주세요", example = "1024")
        Long sessionId,
        @Schema(description = "서버가 잰 시작 시각. 화면의 시계는 이 값과 다를 수 있고, 순위는 서버 시각으로 갑니다")
        LocalDateTime startedAt
) {
    public static MemoryGameStartResponse of(MemoryGameSession session) {
        return new MemoryGameStartResponse(session.getId(), session.getStartedAt());
    }
}
