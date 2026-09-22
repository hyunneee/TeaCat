package com.teacat.server.reward.dto.response;

import com.teacat.server.reward.repository.MemoryGameSessionRepository.MemoryRankRow;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "짝 맞추기 랭킹 한 줄")
public record MemoryRankEntryResponse(
        @Schema(description = "등수 (1부터)", example = "1")
        int rank,
        @Schema(description = "닉네임", example = "티캣냥이")
        String nickname,
        @Schema(description = "걸린 시간(ms). 짧을수록 위입니다", example = "38120")
        int elapsedMs,
        @Schema(description = "뒤집은 횟수", example = "22")
        int moves,
        @Schema(description = "이 줄이 나인가", example = "false")
        boolean me
) {
    public static MemoryRankEntryResponse of(MemoryRankRow row, Long viewerId) {
        return new MemoryRankEntryResponse(row.getRank(), row.getNickname(), row.getElapsedMs(),
                row.getMoves(), row.getUserId().equals(viewerId));
    }
}
