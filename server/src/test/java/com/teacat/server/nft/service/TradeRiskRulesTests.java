package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 규칙 R1~R8 은 맥락만 읽는 순수 함수다. DB 없이 맥락을 만들어 각 규칙의 경계를 확인한다.
 * 스크리너의 보류 판정(HIGH 1개 또는 MEDIUM 2개)도 여기서 본다.
 */
class TradeRiskRulesTests {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 18, 12, 0);
    private static final NftTradeReviewProperties PROPS = new NftTradeReviewProperties(
            true, NftTradeReviewProperties.Mode.FLAG, Duration.ofHours(72),
            Duration.ofDays(30), 3,
            Duration.ofDays(30), 4.0, 3,
            Duration.ofHours(24), Duration.ofMinutes(60),
            Duration.ofDays(7), 4, 3.0, 3,
            0.30, 0.50, 10,
            Duration.ofDays(90), Duration.ofMinutes(30), 2.0,
            Duration.ofDays(90), Duration.ofMinutes(10), true);

    private final NftTradeRiskScreener screener = new NftTradeRiskScreener(null, List.of(
            new TradeRiskSameDeviceRule(), new TradeRiskSamePhoneRule(), new TradeRiskRepeatedPairRule(),
            new TradeRiskPriceOutlierRule(), new TradeRiskNewAccountRushRule(), new TradeRiskVolumeSpikeRule(),
            new TradeRiskHoardingRule(), new TradeRiskAccountTakeoverRule()), PROPS,
            // 모델 파일 없이 만든 채점기 — 점수를 내지 않는다. 이 테스트는 규칙만 본다
            new TradeRiskModelScorer(tools.jackson.databind.json.JsonMapper.builder().build(), false, "fds/none.json"));

    @Test
    void 정상_거래는_아무_신호도_없다() {
        TradeRiskAssessment result = screener.evaluate(normal().build());

        assertThat(result.signals()).isEmpty();
        assertThat(result.flagged()).isFalse();
        assertThat(result.maxSeverity()).isNull();
    }

    @Test
    void R1_판매자와_구매자가_같은_IP_만_쓰면_MEDIUM_이고_UA_까지_같으면_HIGH_다() {
        var sameIp = screener.evaluate(normal()
                .seller(party(1L, "010-1111-1111", "10.0.0.9", "ua-seller"))
                .buyer(party(2L, "010-2222-2222", "10.0.0.9", "ua-buyer")).build());
        var sameDevice = screener.evaluate(normal()
                .seller(party(1L, "010-1111-1111", "10.0.0.9", "ua-shared"))
                .buyer(party(2L, "010-2222-2222", "10.0.0.9", "ua-shared")).build());

        assertThat(only(sameIp, TradeRiskSameDeviceRule.CODE).severity()).isEqualTo(NftReviewSeverity.MEDIUM);
        assertThat(sameIp.flagged()).isFalse(); // MEDIUM 하나로는 막지 않는다
        assertThat(only(sameDevice, TradeRiskSameDeviceRule.CODE).severity()).isEqualTo(NftReviewSeverity.HIGH);
        assertThat(sameDevice.flagged()).isTrue();
    }

    @Test
    void R1_2위_입찰자가_판매자_단말이면_구매자가_멀쩡해도_잡는다() {
        var result = screener.evaluate(normal()
                .seller(party(1L, "010-1111-1111", "10.0.0.9", "ua-shared"))
                .runnerUp(party(3L, "010-3333-3333", "10.0.0.9", "ua-shared")).build());

        NftTradeRiskSignal signal = only(result, TradeRiskSameDeviceRule.CODE);
        assertThat(signal.severity()).isEqualTo(NftReviewSeverity.HIGH);
        assertThat(signal.evidence()).containsEntry("counterpart", "runnerUp");
    }

    @Test
    void R1_단말_정보가_없으면_판단하지_않는다() {
        var result = screener.evaluate(normal()
                .seller(party(1L, "010-1111-1111", null, null))
                .buyer(party(2L, "010-2222-2222", null, null)).build());

        assertThat(result.signals()).isEmpty();
    }

    @Test
    void R2_전화번호가_같으면_HIGH_고_서식이_달라도_숫자만_비교한다() {
        var result = screener.evaluate(normal()
                .seller(party(1L, "010-1234-5678", "1.1.1.1", "a"))
                .buyer(party(2L, "01012345678", "2.2.2.2", "b")).build());

        assertThat(only(result, TradeRiskSamePhoneRule.CODE).severity()).isEqualTo(NftReviewSeverity.HIGH);
        assertThat(result.flagged()).isTrue();
        // evidence 에 번호 원문이 없어야 한다 — AI 프롬프트로 간다
        assertThat(only(result, TradeRiskSamePhoneRule.CODE).evidence().values())
                .noneMatch(v -> String.valueOf(v).contains("1234"));
    }

    @Test
    void R3_반복_거래쌍은_MEDIUM_순환은_HIGH_다() {
        var repeated = screener.evaluate(normal().pairTradeCount(3).build());
        var cycled = screener.evaluate(normal().pairTradeCount(1).photocardCycled(true).build());
        var below = screener.evaluate(normal().pairTradeCount(2).build());

        assertThat(only(repeated, TradeRiskRepeatedPairRule.CODE).severity()).isEqualTo(NftReviewSeverity.MEDIUM);
        assertThat(only(cycled, TradeRiskRepeatedPairRule.CODE).severity()).isEqualTo(NftReviewSeverity.HIGH);
        assertThat(below.signals()).isEmpty();
    }

    @Test
    void R4_시세_대비_4배_이상이면_MEDIUM_이고_표본이_적으면_판단하지_않는다() {
        var outlier = screener.evaluate(normal().price(4_000).medianPrice(1_000L).designTradesInWindow(3).build());
        var fewSamples = screener.evaluate(normal().price(9_000).medianPrice(1_000L).designTradesInWindow(2).build());
        var fair = screener.evaluate(normal().price(3_999).medianPrice(1_000L).designTradesInWindow(10).build());

        assertThat(only(outlier, TradeRiskPriceOutlierRule.CODE).evidence()).containsEntry("ratio", 4.0);
        assertThat(fewSamples.signals()).isEmpty();
        assertThat(fair.signals()).isEmpty();
    }

    @Test
    void R5_가입_24시간_안에_첫_충전_후_60분_안에_걸면_MEDIUM_이다() {
        var rush = screener.evaluate(normal()
                .buyer(party(2L, "010-2222-2222", "2.2.2.2", "b", NOW.minusHours(3)))
                .buyerFirstDepositAt(NOW.minusMinutes(20)).build());
        var oldAccount = screener.evaluate(normal()
                .buyer(party(2L, "010-2222-2222", "2.2.2.2", "b", NOW.minusDays(30)))
                .buyerFirstDepositAt(NOW.minusMinutes(20)).build());
        var slowDeposit = screener.evaluate(normal()
                .buyer(party(2L, "010-2222-2222", "2.2.2.2", "b", NOW.minusHours(3)))
                .buyerFirstDepositAt(NOW.minusMinutes(90)).build());
        var noDeposit = screener.evaluate(normal()
                .buyer(party(2L, "010-2222-2222", "2.2.2.2", "b", NOW.minusHours(3))).build());

        assertThat(only(rush, TradeRiskNewAccountRushRule.CODE).severity()).isEqualTo(NftReviewSeverity.MEDIUM);
        assertThat(oldAccount.signals()).isEmpty();
        assertThat(slowDeposit.signals()).isEmpty();
        assertThat(noDeposit.signals()).isEmpty(); // 관리자 지급만 받은 QA 계정
    }

    @Test
    void R6_최근_거래가_주평균의_3배_이상이고_당사자가_절반_이상_끼면_MEDIUM_이다() {
        // 기준 4주 8건 → 주평균 2 → 최근 7일 6건 이상
        var spike = screener.evaluate(normal().baselineVolume(8).recentVolume(6).recentVolumeWithParties(3).build());
        var notInvolved = screener.evaluate(normal().baselineVolume(8).recentVolume(6).recentVolumeWithParties(2).build());
        var thinBaseline = screener.evaluate(normal().baselineVolume(2).recentVolume(20).recentVolumeWithParties(20).build());

        assertThat(only(spike, TradeRiskVolumeSpikeRule.CODE).severity()).isEqualTo(NftReviewSeverity.MEDIUM);
        assertThat(notInvolved.signals()).isEmpty();
        assertThat(thinBaseline.signals()).isEmpty();
    }

    @Test
    void R7_이_거래로_발행량의_30퍼센트를_넘기거나_최근_도안_거래의_절반을_사들였으면_MEDIUM_이다() {
        var bySupply = screener.evaluate(normal().designIssuedSupply(20).buyerOwnedOfDesign(5).build()); // 6/20
        var byBuys = screener.evaluate(normal().designIssuedSupply(100).buyerOwnedOfDesign(0)
                .designTradesInWindow(9).buyerBuysOfDesignInWindow(4).build()); // (4+1)/(9+1)
        var smallDesign = screener.evaluate(normal().designIssuedSupply(5).buyerOwnedOfDesign(4).build());
        var collector = screener.evaluate(normal().designIssuedSupply(100).buyerOwnedOfDesign(10).build());

        assertThat(only(bySupply, TradeRiskHoardingRule.CODE).evidence()).containsEntry("bySupplyShare", true);
        assertThat(only(byBuys, TradeRiskHoardingRule.CODE).evidence()).containsEntry("byBuyShare", true);
        assertThat(smallDesign.signals()).isEmpty();
        assertThat(collector.signals()).isEmpty();
    }

    @Test
    void R8_다른_단말_이력이_있는_계정이_새_단말_로그인_직후_평소의_2배를_쓰면_HIGH_다() {
        var takeover = screener.evaluate(normal()
                .buyerPriorDeviceLogins(12).buyerDeviceFirstLoginAt(NOW.minusMinutes(5))
                .price(10_000).medianPrice(null).buyerMaxSpendInWindow(3_000L).build());
        var neverLoggedFromDevice = screener.evaluate(normal()
                .buyerPriorDeviceLogins(12).buyerDeviceFirstLoginAt(null)
                .price(10_000).medianPrice(null).buyerMaxSpendInWindow(3_000L).build());
        var longUsedDevice = screener.evaluate(normal()
                .buyerPriorDeviceLogins(12).buyerDeviceFirstLoginAt(NOW.minusDays(3))
                .price(10_000).medianPrice(null).buyerMaxSpendInWindow(3_000L).build());
        var usualSpend = screener.evaluate(normal()
                .buyerPriorDeviceLogins(12).buyerDeviceFirstLoginAt(NOW.minusMinutes(5))
                .price(4_000).medianPrice(null).buyerMaxSpendInWindow(3_000L).build());
        var noHistory = screener.evaluate(normal()
                .buyerPriorDeviceLogins(0).buyerDeviceFirstLoginAt(NOW.minusMinutes(5))
                .price(10_000).medianPrice(null).buyerMaxSpendInWindow(3_000L).build());

        assertThat(only(takeover, TradeRiskAccountTakeoverRule.CODE).severity()).isEqualTo(NftReviewSeverity.HIGH);
        assertThat(only(neverLoggedFromDevice, TradeRiskAccountTakeoverRule.CODE).severity()).isEqualTo(NftReviewSeverity.HIGH);
        assertThat(longUsedDevice.signals()).isEmpty();
        assertThat(usualSpend.signals()).isEmpty();
        assertThat(noHistory.signals()).isEmpty();
    }

    @Test
    void MEDIUM_두_개면_보류하고_규칙_순서는_코드순으로_고정된다() {
        var result = screener.evaluate(normal()
                .pairTradeCount(3)                                        // R3 MEDIUM
                .price(4_000).medianPrice(1_000L).designTradesInWindow(5)         // R4 MEDIUM
                .build());

        assertThat(result.flagged()).isTrue();
        assertThat(result.maxSeverity()).isEqualTo(NftReviewSeverity.MEDIUM);
        assertThat(result.ruleCodes()).containsExactly(TradeRiskRepeatedPairRule.CODE, TradeRiskPriceOutlierRule.CODE);
    }

    private static NftTradeRiskSignal only(TradeRiskAssessment result, String rule) {
        List<NftTradeRiskSignal> matched = result.signals().stream().filter(s -> s.rule().equals(rule)).toList();
        assertThat(matched).as("rule %s", rule).hasSize(1);
        return matched.getFirst();
    }

    private static TradeRiskContext.Party party(Long id, String phone, String ip, String ua) {
        return party(id, phone, ip, ua, NOW.minusDays(100));
    }

    private static TradeRiskContext.Party party(Long id, String phone, String ip, String ua, LocalDateTime createdAt) {
        return new TradeRiskContext.Party(id, phone, createdAt, ip, ua);
    }

    /** 어느 규칙에도 걸리지 않는 기본 맥락. 각 테스트가 필요한 값만 바꾼다 */
    private static ContextBuilder normal() {
        return new ContextBuilder();
    }

    private static class ContextBuilder {
        private TradeRiskContext.Party seller = party(1L, "010-1111-1111", "1.1.1.1", "ua-seller");
        private TradeRiskContext.Party buyer = party(2L, "010-2222-2222", "2.2.2.2", "ua-buyer");
        private TradeRiskContext.Party runnerUp = party(3L, "010-3333-3333", "3.3.3.3", "ua-runner");
        private long price = 1_000;
        private int pairTradeCount = 0;
        private boolean photocardCycled = false;
        private Long medianPrice = 1_000L;
        private int recentVolume = 2;
        private int recentVolumeWithParties = 1;
        private int baselineVolume = 8;
        private int designIssuedSupply = 100;
        private int buyerOwnedOfDesign = 1;
        private int designTradesInWindow = 10;
        private int buyerBuysOfDesignInWindow = 1;
        private LocalDateTime buyerFirstDepositAt = NOW.minusDays(50);
        private int buyerPriorDeviceLogins = 5;
        private LocalDateTime buyerDeviceFirstLoginAt = NOW.minusDays(40);
        private Long buyerMaxSpendInWindow = 2_000L;

        ContextBuilder seller(TradeRiskContext.Party v) { seller = v; return this; }
        ContextBuilder buyer(TradeRiskContext.Party v) { buyer = v; return this; }
        ContextBuilder runnerUp(TradeRiskContext.Party v) { runnerUp = v; return this; }
        ContextBuilder price(long v) { price = v; return this; }
        ContextBuilder pairTradeCount(int v) { pairTradeCount = v; return this; }
        ContextBuilder photocardCycled(boolean v) { photocardCycled = v; return this; }
        ContextBuilder medianPrice(Long v) { medianPrice = v; return this; }
        ContextBuilder recentVolume(int v) { recentVolume = v; return this; }
        ContextBuilder recentVolumeWithParties(int v) { recentVolumeWithParties = v; return this; }
        ContextBuilder baselineVolume(int v) { baselineVolume = v; return this; }
        ContextBuilder designIssuedSupply(int v) { designIssuedSupply = v; return this; }
        ContextBuilder buyerOwnedOfDesign(int v) { buyerOwnedOfDesign = v; return this; }
        ContextBuilder designTradesInWindow(int v) { designTradesInWindow = v; return this; }
        ContextBuilder buyerBuysOfDesignInWindow(int v) { buyerBuysOfDesignInWindow = v; return this; }
        ContextBuilder buyerFirstDepositAt(LocalDateTime v) { buyerFirstDepositAt = v; return this; }
        ContextBuilder buyerPriorDeviceLogins(int v) { buyerPriorDeviceLogins = v; return this; }
        ContextBuilder buyerDeviceFirstLoginAt(LocalDateTime v) { buyerDeviceFirstLoginAt = v; return this; }
        ContextBuilder buyerMaxSpendInWindow(Long v) { buyerMaxSpendInWindow = v; return this; }

        TradeRiskContext build() {
            return new TradeRiskContext(7L, TradeRiskContext.Source.AUCTION, 11L, null, price, 501L, 31L,
                    seller, buyer, runnerUp, NOW.minusMinutes(1),
                    pairTradeCount, photocardCycled, medianPrice,
                    recentVolume, recentVolumeWithParties, baselineVolume,
                    designIssuedSupply, buyerOwnedOfDesign, designTradesInWindow, buyerBuysOfDesignInWindow,
                    buyerFirstDepositAt, buyerPriorDeviceLogins, buyerDeviceFirstLoginAt, buyerMaxSpendInWindow,
                    // 규칙 R1~R8 은 그래프 값을 읽지 않는다 — 피처 전용이다 (AUCTION_FRAUD_DESIGN.md 14-2-2)
                    TradeRiskContext.Graph.EMPTY, NOW);
        }
    }
}
