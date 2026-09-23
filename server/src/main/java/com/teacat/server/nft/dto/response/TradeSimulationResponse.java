package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 시뮬레이션 한 판의 결과. 대본(정답)과 규칙 판정을 맞대어 본 성적표다 (AUCTION_FRAUD_DESIGN.md 14-2).
 *
 * <p>이 숫자는 <b>합성 데이터 기준</b>이다. 실데이터 정밀도가 아니다 — 대본을 우리가 짰으니
 * 규칙이 잘 잡는 것이 당연하다. 이 판의 쓸모는 "얼마나 잘 잡나" 가 아니라
 * <b>"어떤 사기를 규칙이 원리적으로 못 잡나"</b> 를 드러내는 데 있다(3단 순환 거래).
 *
 * @param truePositives  사기 대본인데 규칙도 걸러낸 것
 * @param falseNegatives 사기 대본인데 규칙이 놓친 것 — 모델이 메워야 할 자리
 * @param falsePositives 정상인데 규칙이 걸어 버린 것 — 사람이 헛일하게 만드는 자리
 * @param precision      걸린 것 중 진짜 사기 비율. 걸린 게 없으면 null
 * @param recall         사기 중 잡아낸 비율. 사기 표본이 없으면 null
 */
@Schema(description = "이상거래 시뮬레이션 결과")
public record TradeSimulationResponse(

        @Schema(description = "이 판의 식별자. 되돌릴 때 이 값으로 지운다")
        UUID batchId,

        @Schema(description = "심사 경로를 태운 거래 수 (과거 거래는 제외)")
        int screenedTrades,

        @Schema(description = "그중 규칙에 걸린 거래 수")
        int flaggedTrades,

        @Schema(description = "대본별 거래 수")
        Map<String, Integer> byScenario,

        @Schema(description = "규칙 코드별 적중 수")
        Map<String, Integer> ruleHits,

        int truePositives,
        int falseNegatives,
        int falsePositives,
        int trueNegatives,

        @Schema(description = "정밀도 (TP / (TP+FP))")
        Double precision,

        @Schema(description = "재현율 (TP / (TP+FN))")
        Double recall,

        @Schema(description = "규칙이 놓친 사기 대본의 내역. 여기가 모델을 붙일 이유다")
        List<Miss> misses
) {

    @Schema(description = "규칙이 놓친 사기 거래 한 건")
    public record Miss(Long tradeId, String scenario, String note) {}
}
