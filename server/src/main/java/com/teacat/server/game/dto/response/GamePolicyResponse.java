package com.teacat.server.game.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "방을 만들기 전에 보여줄 규칙")
public record GamePolicyResponse(

        @Schema(description = "화면에 띄울 빠른 선택 금액. 0은 연습 모드입니다. 직접 입력해도 됩니다",
                example = "[0, 100, 500, 1000]")
        List<Long> betChoices,

        @Schema(description = "걸 수 있는 최대 금액. 0부터 이 값까지는 직접 입력해도 받습니다", example = "1000")
        long maxBet,

        @Schema(description = """
                보조금을 받으려면 최소 이만큼 걸어야 합니다. 이보다 적게 걸면 판은 그대로
                돌아가고 보조금만 빠집니다 — 1 캣머니짜리 판으로 보조금만 긁어가는 것을 막습니다.
                """, example = "100")
        long subsidyMinBet,

        @Schema(description = "판마다 참가자 한 명당 운영이 얹어주는 금액", example = "100")
        long subsidyPerPlayer,

        @Schema(description = "오늘 내가 아직 받을 수 있는 보조금", example = "1200")
        long remainingSubsidyToday,

        @Schema(description = "인원수별 등수 배분 비율(%). 인덱스 = 인원수 − 1",
                example = "[[100], [70, 30], [55, 30, 15], [45, 28, 17, 10]]")
        List<List<Integer>> prizeShares) {
}
