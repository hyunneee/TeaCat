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
        return scorer(resource, 0.25);
    }

    private TradeRiskModelScorer scorer(String resource, double outOfRangeLimit) {
        TradeRiskModelScorer scorer = new TradeRiskModelScorer(MAPPER, true, resource, outOfRangeLimit);
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
        TradeRiskModelScorer scorer = new TradeRiskModelScorer(MAPPER, false, "fds/test-model.json", 0.25);
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

    /**
     * 🔴 2026-09-23 dev 회귀. 실거래 4건이 전부 1.000 이 나왔다 — 합성 시장에 없던 크기가 들어와
     * 한 피처가 z 를 +1710 까지 밀었다. 이제는 학습 범위로 눌러 기여도가 제한된다.
     */
    @Test
    void 학습_범위를_넘는_값은_눌러서_계산한다() {
        // 피처가 2개뿐이라 하나만 잘려도 기본 한도(0.25)를 넘는다. 여기서는 자르기 자체를 보려고 한도를 푼다
        TradeRiskModelScorer scorer = scorer("fds/test-model.json", 0.5);

        // priceRatio 의 hi 는 3.0. 100 이 들어와도 3.0 으로 눌려 상한과 같은 점수가 나와야 한다
        Double huge = scorer.score(features(100.0, false));
        Double atCap = scorer.score(features(3.0, false));

        assertThat(huge).isNotNull().isEqualTo(atCap);
        assertThat(huge).isLessThan(1.0);
    }

    /** 잘린 피처가 너무 많으면 이 거래는 모델이 아는 세상 밖이다. 억지 점수보다 "판단 불가" 가 정직하다 */
    @Test
    void 범위_밖_피처가_많으면_채점하지_않는다() {
        // 피처 2개 중 1개만 넘어도 한도(50%)를 "넘지는" 않으므로 점수가 나온다
        assertThat(scorer("fds/test-model.json", 0.5).score(features(100.0, false))).isNotNull();

        // 한도를 0 으로 두면 하나만 잘려도 판단하지 않는다
        assertThat(scorer("fds/test-model.json", 0.0).score(features(100.0, false))).isNull();
        // 범위 안이면 그대로 채점한다
        assertThat(scorer("fds/test-model.json", 0.0).score(features(1.0, true))).isNotNull();
    }

    /**
     * 🔴 모델 파일에 lo·hi 가 없는 예전 모델이 배포돼 있어도 터무니없는 점수는 내보내지 않는다.
     * dev 회귀 당시 z 가 +1744 였다 — 그건 확신이 아니라 계산이 망가진 것이다.
     */
    @Test
    void 범위_정보가_없는_모델이어도_폭주한_점수는_내지_않는다() {
        // legacy-model.json 에는 lo·hi 가 없어 자르기가 동작하지 않는다
        TradeRiskModelScorer scorer = scorer("fds/legacy-model.json");

        assertThat(scorer.score(features(1.0, false))).isNotNull();   // 평범한 값은 그대로 채점
        assertThat(scorer.score(features(100000.0, false))).isNull(); // z 가 폭주하면 판단 불가
    }

    /**
     * 🔴 범위 정보가 있는 모델에는 로짓 상한을 걸지 않는다. 자르기가 이미 z 를 묶으므로,
     * 상한을 걸면 <b>가장 확실한 탐지가 잘려 나간다</b> — 실제로 한도 15 에서 부정 거래
     * 740건 중 상위 5건이 "판단 불가" 로 빠졌다.
     */
    @Test
    void 범위_정보가_있으면_높은_점수도_그대로_낸다() {
        // priceRatio 를 상한(3.0)까지 올리고 불리언도 켜면 z 가 꽤 커진다
        Double high = scorer("fds/test-model.json", 1.0).score(features(3.0, true));

        assertThat(high).isNotNull().isGreaterThan(0.99);
    }
}
