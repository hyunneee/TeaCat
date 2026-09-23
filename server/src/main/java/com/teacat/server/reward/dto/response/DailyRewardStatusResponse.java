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

        /**
         * 연속 출석 일수.
         *
         * <p>출석 카드 옆에 바로 띄우려고 여기 함께 싣는다. 달력 조회(한 달치)를 따로
         * 부르게 하면 숫자 하나를 위해 한 달을 받아오게 된다.
         *
         * <p>🔴 <b>화면에서 세지 않는다.</b> 자정 경계·시간대 때문에 기기 시계로 세면
         * 사람마다 다르게 나오고, 한 달치 응답만으로는 월초에 지난달에서 이어온 것이 빠진다.
         * 마지막 출석이 어제보다 예전이면 0 이다.
         */
        @Schema(description = "연속 출석 일수. 마지막 출석이 어제보다 예전이면 0", example = "3")
        long streak,

        @Schema(description = "보상 종류별 상태")
        List<RewardStateResponse> rewards
) {
}
