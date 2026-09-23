package com.teacat.server.nft.service;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 섀도우 모델 채점기 (AUCTION_FRAUD_DESIGN.md 14-3).
 *
 * <p>여기서 지키는 것은 정확도가 아니라 <b>정산을 절대 막지 않는다</b> 는 성질이다.
 * 모델은 아직 아무 결정권이 없는데, 그것 때문에 거래가 실패하면 앞뒤가 안 맞는다.
 */
class TradeRiskModelScorerTests {

    private static final ObjectMapper MAPPER = tools.jackson.databind.json.JsonMapper.builder().build();

    private TradeRiskModelScorer scorer(String resource) {
        TradeRiskModelScorer scorer = new TradeRiskModelScorer(MAPPER, true, resource);
        scorer.load();
        return scorer;
    }

    private Map<String, Object> features(Object priceRatio, Object owned) {
        Map<String, Object> f = new HashMap<>();
        f.put("priceRatio", priceRatio);
        f.put("buyerPreviouslyOwnedCard", owned);
        return f;
    }

    @Test
    void 계수대로_확률을_계산한다() {
        // fds/test-model.json: intercept -1, priceRatio(coef 2, mean 1, std 1), buyerPreviouslyOwnedCard(coef 3)
        // z = -1 + 2*((1-1)/1) + 3*((1-0)/1) = 2  →  1/(1+e^-2) = 0.8808
        Double score = scorer("fds/test-model.json").score(features(1.0, true));

        assertThat(score).isNotNull().isEqualTo(0.88080, org.assertj.core.data.Offset.offset(0.0001));
    }

    @Test
    void 불리언은_학습때와_같이_1과_0으로_읽는다() {
        TradeRiskModelScorer scorer = scorer("fds/test-model.json");

        // z = -1 + 0 + 0 = -1  →  0.2689
        assertThat(scorer.score(features(1.0, false))).isEqualTo(0.26894, org.assertj.core.data.Offset.offset(0.0001));
        assertThat(scorer.score(features(1.0, true)))
                .isGreaterThan(scorer.score(features(1.0, false)));
    }

    /** 값이 없으면 0 이 아니라 학습 때의 중앙값으로 채운다 — 0 으로 채우면 "모름" 이 "정상" 으로 둔갑한다 */
    @Test
    void 없는_값은_대치값으로_채운다() {
        TradeRiskModelScorer scorer = scorer("fds/test-model.json");

        // buyerPreviouslyOwnedCard 의 impute 는 0 이므로 null 과 false 가 같은 점수여야 한다
        assertThat(scorer.score(features(1.0, null)))
                .isEqualTo(scorer.score(features(1.0, false)));
        // 아예 키가 없어도 같다
        assertThat(scorer.score(Map.of("priceRatio", 1.0)))
                .isEqualTo(scorer.score(features(1.0, false)));
    }

    @Test
    void 모델_파일이_없으면_점수를_내지_않는다() {
        TradeRiskModelScorer scorer = scorer("fds/does-not-exist.json");

        assertThat(scorer.score(features(1.0, true))).isNull();
        assertThat(scorer.version()).isNull();
    }

    @Test
    void 설정으로_끄면_파일이_있어도_채점하지_않는다() {
        TradeRiskModelScorer scorer = new TradeRiskModelScorer(MAPPER, false, "fds/test-model.json");
        scorer.load();

        assertThat(scorer.score(features(1.0, true))).isNull();
    }

    /** 심사가 꺼져 있거나 맥락을 못 읽으면 피처가 빈 맵이다. 전부 대치값으로 채운 점수는 "모름" 이지 예측이 아니다 */
    @Test
    void 피처가_비면_채점하지_않는다() {
        TradeRiskModelScorer scorer = scorer("fds/test-model.json");

        assertThat(scorer.score(Map.of())).isNull();
        assertThat(scorer.score(null)).isNull();
    }

    @Test
    void 이상한_값이_들어와도_터지지_않는다() {
        TradeRiskModelScorer scorer = scorer("fds/test-model.json");

        Map<String, Object> odd = new HashMap<>();
        odd.put("priceRatio", "문자열");
        odd.put("buyerPreviouslyOwnedCard", Double.NaN);
        assertThat(scorer.score(odd)).isNotNull().isBetween(0.0, 1.0);
    }
}
