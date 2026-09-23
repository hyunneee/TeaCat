package com.teacat.server.reward.dto.response;

import com.teacat.server.reward.entity.MemoryGameSession;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "짝 맞추기 결과")
public record MemoryGameResultResponse(
        @Schema(description = "이 판의 ID", example = "1024")
        Long sessionId,
        @Schema(description = "서버가 잰 걸린 시간(ms). 화면의 시계가 아니라 이 값이 순위에 들어갑니다", example = "41230")
        int elapsedMs,
        @Schema(description = "뒤집은 횟수", example = "24")
        int moves,
        @Schema(description = "오늘 내 최고 기록 기준 등수. 아직 순위가 없으면 null", example = "3", nullable = true)
        Integer todayRank,
        @Schema(description = "이 판이 오늘 내 최고 기록인가", example = "true")
        boolean personalBest
) {
    public static MemoryGameResultResponse of(MemoryGameSession session, Integer todayRank,
                                              boolean personalBest) {
        return new MemoryGameResultResponse(session.getId(), session.getElapsedMs(),
                session.getMoves(), todayRank, personalBest);
    }
}
