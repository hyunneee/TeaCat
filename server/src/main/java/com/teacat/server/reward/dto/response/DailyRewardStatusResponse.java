package com.teacat.server.reward.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

/**
 * 오늘의 보상 현황.
 *
 * <p>종류별로 따로 묻지 않고 한 번에 내려준다 — 캣머니 화면이 출석과 송편을 한 화면에 같이
 * 그리기 때문이다. 종류가 늘어도 목록이라 응답 모양이 바뀌지 않는다.
 *
 * <p>{@code date} 를 함께 내려주는 이유는 <b>날이 바뀌는 기준이 서버(Asia/Seoul)</b>이기
 * 때문이다. 기기 시계가 다른 시간대면 "내일 다시" 가 언제인지 화면 혼자서는 알 수 없다.
 */
@Schema(description = "오늘의 캣머니 보상 현황")
public record DailyRewardStatusResponse(

        @Schema(description = "기준 날짜 (Asia/Seoul)", example = "2026-09-21")
        LocalDate date,

        @Schema(description = "보상 종류별 상태")
        List<RewardStateResponse> rewards
) {
}
