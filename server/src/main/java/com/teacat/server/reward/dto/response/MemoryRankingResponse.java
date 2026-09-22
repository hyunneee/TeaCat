package com.teacat.server.reward.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

/**
 * 오늘의 짝 맞추기 랭킹.
 *
 * <p>어제 1등을 함께 내려보낸다. "1등하면 내일 캣머니를 받는다" 는 규칙은 어제 누가 받았는지
 * 보여줘야 믿긴다 — 규칙만 적어 두면 진짜 주는지 알 수 없다.
 */
@Schema(description = "짝 맞추기 일일 랭킹")
public record MemoryRankingResponse(
        @Schema(description = "이 랭킹의 날짜")
        LocalDate date,
        @Schema(description = "1등 상금(캣머니). 다음날 자동으로 지급됩니다", example = "1000")
        long prize,
        @Schema(description = "상위 랭킹. 사람마다 그날 가장 빠른 판 하나만 오릅니다")
        List<MemoryRankEntryResponse> entries,
        @Schema(description = "순위표 밖이어도 내 등수. 오늘 깬 적이 없으면 null", nullable = true)
        MemoryRankEntryResponse myRank,
        @Schema(description = "어제 1등. 없으면 null", nullable = true)
        MemoryRankEntryResponse yesterdayWinner
) {
}
