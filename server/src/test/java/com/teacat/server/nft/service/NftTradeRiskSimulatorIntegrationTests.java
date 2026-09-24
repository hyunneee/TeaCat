package com.teacat.server.nft.service;

import com.teacat.server.nft.dto.request.TradeSimulationRequest;
import com.teacat.server.nft.dto.response.TradeSimulationResponse;
import com.teacat.server.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 시뮬레이터가 <b>대본대로</b> 데이터를 만드는지 본다 (AUCTION_FRAUD_DESIGN.md 14-2).
 *
 * <p>여기서 확인하는 것은 "규칙이 잘 잡는가" 가 아니다 — 대본을 우리가 짰으니 잡는 게 당연하다.
 * 확인하는 것은 <b>대본이 의도한 조건을 정말 만들어 냈는가</b> 다. 대본이 어긋나 있으면
 * 학습 데이터가 통째로 엉뚱한 것이 되고, 그건 모델을 붙인 뒤에야 드러난다.
 */
@TestPropertySource(properties = "nft.trade.simulator.enabled=true")
class NftTradeRiskSimulatorIntegrationTests extends PostgresIntegrationTest {

    @Autowired private NftTradeRiskSimulator simulator;

    /** 씨앗을 고정해 같은 판이 나오게 한다. 규모는 대본이 다 돌아갈 만큼만 작게 잡는다 */
    private TradeSimulationResponse run() {
        return simulator.simulate(new TradeSimulationRequest(2, 12, 20, 2, 1, 1, 2, 3, 42L));
    }

    @Test
    void 사기_대본은_노린_규칙에_걸린다() {
        TradeSimulationResponse report = run();

        assertThat(report.ruleHits()).containsKeys(
                TradeRiskSameDeviceRule.CODE,        // 자전 입찰 — 공범이 판매자와 같은 단말
                TradeRiskSamePhoneRule.CODE,         // 자전 입찰 — 같은 전화번호
                TradeRiskPriceOutlierRule.CODE,      // 자전 입찰 — 시세의 5배
                TradeRiskRepeatedPairRule.CODE,      // 2단 순환 — 카드가 원래 주인에게 되돌아옴
                TradeRiskHoardingRule.CODE,          // 매집 — 발행량의 30% 이상
                TradeRiskAccountTakeoverRule.CODE);  // 계정 탈취 — 새 단말 직후 고액
        assertThat(report.truePositives()).isPositive();
    }

    @Test
    void 정상_표본이_더_많고_대부분_통과한다() {
        TradeSimulationResponse report = run();

        // 실제 이상거래는 드물다. 합성에서 비율을 1:1 로 맞추면 현실에 없는 분포를 모델이 배운다
        assertThat(report.byScenario().get(NftTradeRiskSimulator.NORMAL))
                .isGreaterThan(report.byScenario().getOrDefault(NftTradeRiskSimulator.SHILL, 0));
        // 정상 표본이 무더기로 걸리면 대본이 잘못 짜인 것이다 — 규칙의 오탐이 아니라
        assertThat(report.falsePositives()).isLessThanOrEqualTo(report.trueNegatives() / 4);
    }

    /**
     * 🔴 이 테스트는 "실패해야 정상" 인 것을 고정한다. 3단 순환(A→B→C→A)은 규칙으로 못 잡는다 —
     * R3 의 순환 판정이 두 사람 사이로 한정돼 있어 마지막 구간에서 C 와 A 는 처음 거래하는 사이다.
     * 언젠가 이게 깨지면(= 잡히면) 규칙이 바뀐 것이고, 그때 모델의 역할도 다시 따져야 한다.
     */
    @Test
    void 삼단_순환은_규칙이_못_잡는다() {
        TradeSimulationResponse report = run();

        assertThat(report.misses())
                .extracting(TradeSimulationResponse.Miss::scenario)
                .contains(NftTradeRiskSimulator.CIRCULAR_RING);
        assertThat(report.ruleHits()).doesNotContainKey("R_RING_DETECTION");
        assertThat(report.falseNegatives()).isPositive();
    }

    /**
     * 🔴 14-2-2 의 핵심. 규칙은 3단 순환을 못 잡지만, <b>피처에는 정보가 있어야</b> 모델이 배울 수 있다.
     *
     * <p>고리가 닫히는 마지막 구간에서 구매자는 이 카드를 전에 가졌던 사람이다. 고리가 몇 단이든 성립한다.
     * 정상 표본에는 이 값이 하나도 없어야 한다 — 있으면 피처가 정상까지 같이 가리켜 쓸모가 없다.
     */
    @Test
    void 삼단_순환의_닫히는_구간은_그래프_피처에_드러난다() {
        TradeSimulationResponse report = run();

        Boolean ringClosing = jdbcTemplate.queryForObject("""
                SELECT bool_and((f.features->>'buyerPreviouslyOwnedCard')::boolean)
                  FROM simulation_labels l JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id
                 WHERE l.batch_id = ? AND l.scenario = ? AND l.note LIKE '3단 순환 3/3%'
                """, Boolean.class, report.batchId(), NftTradeRiskSimulator.CIRCULAR_RING);
        assertThat(ringClosing).isTrue();

        Integer normalWithSignal = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM simulation_labels l
                  JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id
                 WHERE l.batch_id = ? AND l.scenario = ?
                   AND (f.features->>'buyerPreviouslyOwnedCard')::boolean
                """, Integer.class, report.batchId(), NftTradeRiskSimulator.NORMAL);
        assertThat(normalWithSignal).isZero();
    }

    @Test
    void 만든_거래는_모두_피처를_남긴다() {
        TradeSimulationResponse report = run();

        Integer withFeatures = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM simulation_labels l
                  JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id
                 WHERE l.batch_id = ?
                """, Integer.class, report.batchId());
        assertThat(withFeatures).isEqualTo(report.screenedTrades());
    }

    /** 심사가 끝난 거래는 체인을 타지 않고 바로 완료된다 — 스케줄러가 집어 갈 PENDING 이 남으면 안 된다 */
    @Test
    void 심사를_마친_거래는_PENDING_으로_남지_않는다() {
        TradeSimulationResponse report = run();

        Integer pending = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM simulation_labels l
                  JOIN nft_photocard_trades t ON t.id = l.trade_id
                 WHERE l.batch_id = ? AND t.chain_status = 'PENDING'
                """, Integer.class, report.batchId());
        assertThat(pending).isZero();
    }

    /**
     * 🔴 꾸밈 세탁은 <b>규칙이 원리적으로 못 잡는다</b> — R4 가 꾸민 카드를 판단하지 않기 때문이다.
     * 그래서 남는 단서는 행동뿐이고, 그게 피처에 들어 있어야 모델이 배울 수 있다 (설계문서 14-2-3).
     */
    @Test
    void 꾸밈_세탁은_규칙이_못_잡고_행동_피처에만_드러난다() {
        TradeSimulationResponse report = run();

        // 규칙은 한 건도 못 잡는다
        assertThat(report.misses())
                .extracting(TradeSimulationResponse.Miss::scenario)
                .contains(NftTradeRiskSimulator.DECOR_LAUNDERING);

        // 꾸민 지 얼마 만에 팔았나 — 세탁은 분 단위, 정상은 날 단위여야 갈린다
        Double launderingMinutes = jdbcTemplate.queryForObject("""
                SELECT max((f.features->>'minutesSinceDecoration')::numeric)
                  FROM simulation_labels l JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id
                 WHERE l.batch_id = ? AND l.scenario = ?
                """, Double.class, report.batchId(), NftTradeRiskSimulator.DECOR_LAUNDERING);
        Double normalMinutes = jdbcTemplate.queryForObject("""
                SELECT min((f.features->>'minutesSinceDecoration')::numeric)
                  FROM simulation_labels l JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id
                 WHERE l.batch_id = ? AND l.scenario = ?
                   AND f.features->>'minutesSinceDecoration' IS NOT NULL
                """, Double.class, report.batchId(), NftTradeRiskSimulator.NORMAL);

        assertThat(launderingMinutes).isNotNull().isLessThan(60);
        if (normalMinutes != null) {
            assertThat(normalMinutes).isGreaterThan(launderingMinutes);
        }
    }

    /** 꾸밈 자체가 사기 표지가 되면 안 된다 — 정상 거래에도 꾸민 카드가 섞여 있어야 한다 */
    @Test
    void 정상_거래에도_꾸민_카드가_섞인다() {
        TradeSimulationResponse report = run();

        Integer decorated = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM simulation_labels l
                  JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id
                 WHERE l.batch_id = ? AND l.scenario = ?
                   AND (f.features->>'hasDecoration')::boolean
                """, Integer.class, report.batchId(), NftTradeRiskSimulator.NORMAL);
        assertThat(decorated).isPositive();
    }
}
