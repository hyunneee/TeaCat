package com.teacat.server.nft.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 피처의 <b>표본 가드</b> (AUCTION_FRAUD_DESIGN.md 14-2-3).
 *
 * <p>🔴 비율은 분모가 충분할 때만 스케일 불변이다. 분모가 2면 비율이 아니라 잡음이다.
 * 규칙에는 이 가드가 처음부터 있었는데(R4 표본 3건, R6 기준 3건, R7 발행량 10장) 피처에만 없었다.
 * 그래서 R7 이 "발행량 2장은 판단하지 않는다" 고 넘긴 거래를 모델은 "지분 50%" 로 읽었다.
 *
 * <p>2026-09-25 dev 실거래에서 드러났다 — 발행량 2장·같은 도안 과거 거래 1건짜리 거래가
 * priceRatio 200, ownedShareAfter 0.5 를 내며 점수 1.000 이 됐다.
 */
class TradeRiskFeatureVectorTests {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 25, 12, 0);

    private TradeRiskContext.Party party(long id) {
        return new TradeRiskContext.Party(id, "010-1111-1111", NOW.minusDays(100), "1.1.1.1", "ua");
    }

    /**
     * @param designTrades 같은 도안 최근 거래 수 — priceRatio·buyShareAfter·partyVolumeShare 의 분모
     * @param supply       발행량 — ownedShareAfter 의 분모
     * @param spendCount   구매자의 구매 이력 건수 — spendRatio 의 분모
     */
    private Map<String, Object> features(int designTrades, int supply, int spendCount) {
        return TradeRiskFeatureVector.of(new TradeRiskContext(
                7L, TradeRiskContext.Source.LISTING, null, 11L, 200L, 501L, 31L,
                party(1L), party(2L), null, NOW.minusMinutes(1),
                0, false,
                100L, designTrades, designTrades, 0,
                supply, 0, designTrades, 0,
                NOW.minusDays(50), 0, null, 100L, spendCount,
                TradeRiskContext.Graph.EMPTY, TradeRiskContext.Decoration.NONE,
                TradeRiskContext.Velocity.EMPTY, NOW));
    }

    @Test
    void 표본이_충분하면_비율을_내놓는다() {
        Map<String, Object> f = features(10, 20, 5);

        assertThat(f.get("priceRatio")).isNotNull();
        assertThat(f.get("ownedShareAfter")).isNotNull();
        assertThat(f.get("buyShareAfter")).isNotNull();
        assertThat(f.get("partyVolumeShare")).isNotNull();
        assertThat(f.get("spendRatio")).isNotNull();
        assertThat(f).containsEntry("hasPriceReference", true).containsEntry("hasSpendHistory", true);
    }

    /** dev 실거래가 정확히 이 모양이었다 — 발행량 2장, 같은 도안 과거 거래 1건, 구매 이력 1건 */
    @Test
    void 표본이_모자라면_비율을_말하지_않는다() {
        Map<String, Object> f = features(1, 2, 1);

        assertThat(f.get("priceRatio")).as("거래 1건으로는 시세를 말할 수 없다").isNull();
        assertThat(f.get("ownedShareAfter")).as("발행량 2장으로는 지분을 말할 수 없다").isNull();
        assertThat(f.get("buyShareAfter")).as("거래 1건으로는 구매 비중을 말할 수 없다").isNull();
        assertThat(f.get("partyVolumeShare")).as("거래 1건으로는 참여 비율을 말할 수 없다").isNull();
        assertThat(f.get("spendRatio")).as("구매 1건은 평소 지출의 기준선이 못 된다").isNull();
    }

    /** 짝 불리언이 "값이 없다" 를 모델에 알린다 — null 과 0 을 구분하는 장치다 */
    @Test
    void 표본이_모자라면_짝_불리언도_false_다() {
        Map<String, Object> f = features(1, 2, 1);

        assertThat(f).containsEntry("hasPriceReference", false).containsEntry("hasSpendHistory", false);
    }

    /** 가드는 규칙의 기준을 그대로 옮긴 것이다. 경계에서 한 칸 차이로 갈린다 */
    @Test
    void 가드는_규칙과_같은_경계를_쓴다() {
        assertThat(features(3, 10, 2).get("priceRatio")).as("R4 표본 3건").isNotNull();
        assertThat(features(2, 10, 2).get("priceRatio")).isNull();

        assertThat(features(3, 10, 2).get("ownedShareAfter")).as("R7 발행량 10장").isNotNull();
        assertThat(features(3, 9, 2).get("ownedShareAfter")).isNull();

        assertThat(features(3, 10, 2).get("spendRatio")).as("구매 이력 2건").isNotNull();
        assertThat(features(3, 10, 1).get("spendRatio")).isNull();
    }
}
