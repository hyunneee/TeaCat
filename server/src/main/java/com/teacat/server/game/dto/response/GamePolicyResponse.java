package com.teacat.server.game.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "방을 만들기 전에 보여줄 규칙")
public record GamePolicyResponse(

        @Schema(description = "고를 수 있는 판돈. 0은 연습 모드입니다", example = "[0, 100, 500, 1000]")
        List<Long> betChoices,

        @Schema(description = "판마다 참가자 한 명당 운영이 얹어주는 금액", example = "100")
        long subsidyPerPlayer,

        @Schema(description = "오늘 내가 아직 받을 수 있는 보조금", example = "1200")
        long remainingSubsidyToday,

        @Schema(description = "인원수별 등수 배분 비율(%). 인덱스 = 인원수 − 1",
                example = "[[100], [70, 30], [55, 30, 15], [45, 28, 17, 10]]")
        List<List<Integer>> prizeShares) {
}
