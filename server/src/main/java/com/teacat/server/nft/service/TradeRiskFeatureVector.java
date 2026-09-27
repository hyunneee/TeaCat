package com.teacat.server.nft.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 규칙이 본 맥락을 학습용 피처 벡터로 바꾼다 (AUCTION_FRAUD_DESIGN.md 14-2).
 *
 * <p>🔴 <b>규칙과 같은 맥락 객체를 쓴다.</b> 학습용 조회를 따로 짜면 서빙 때 쓰는 값과 미묘하게 어긋난다
 * (training-serving skew) — ML 시스템에서 가장 흔하고 가장 늦게 발견되는 버그다. 피처 정의는 이 파일 하나뿐이다.
 *
 * <p>🔴 <b>개인정보를 넣지 않는다.</b> IP·UA 해시·전화번호 원문 대신 "같음/다름" 불리언만 담는다.
 * 규칙 신호의 evidence 와 같은 원칙이고, 이 표는 나중에 파이썬으로 그대로 빠져나간다.
 *
 * <p>파생값(배율·경과 분)을 미리 계산해 담는 이유도 같다. 학습 스크립트가 다시 계산하면 반올림·시간대에서
 * 어긋날 수 있고, 어긋나도 아무도 모른다.
 */
final class TradeRiskFeatureVector {

    /*
     * 🔴 표본 가드 — 규칙이 "판단 불가" 라고 한 것은 피처도 말하지 않는다.
     *
     * 비율은 분모가 충분할 때만 스케일 불변이다. 분모가 2면 비율이 아니라 잡음이다.
     * 규칙에는 이 가드가 처음부터 있었는데(R4 표본 3건, R6 기준 3건, R7 발행량 10장) 피처에만 없었다.
     * 그래서 R7 이 "발행량 2장은 판단하지 않는다" 고 넘긴 거래를 모델은 "지분 50%" 라는 강한 신호로 읽었다.
     *
     * 2026-09-25 dev 실거래에서 드러났다 — 발행량 2장·같은 도안 과거 거래 1건짜리 거래가
     * priceRatio 200, ownedShareAfter 0.5, buyShareAfter 0.5 를 내며 점수 1.000 이 됐다.
     * 자르기(winsorize)로는 못 막는다. 200배를 10배로 눌러도 "시세의 10배" 라는 틀린 말이 남는다.
     * 비율을 말할 표본이 없다고 인정하는 것이 맞다.
     *
     * ⚠️ 운영 도안 280개가 전부 발행량 10장 미만이다(평균 1.6장). 티켓 한 장에 카드 한 장이
     *    나오는 구조라 앞으로도 그렇다 — ownedShareAfter 는 이 서비스에서 사실상 늘 null 이고,
     *    그것이 사실이다. 매집은 지분이 아니라 구매 비중·속도로 봐야 한다.
     */
    private static final int MIN_PRICE_SAMPLES = 3;           // R4 price-min-samples
    private static final int MIN_VOLUME_SAMPLES = 3;          // R6 volume-min-baseline
    private static final int MIN_SUPPLY_FOR_SHARE = 10;       // R7 hoard-min-supply
    private static final int MIN_DESIGN_TRADES_FOR_BUY_SHARE = 3;  // R7 내부 상수와 같은 값
    /** 구매 이력 1건은 "평소 최대 지출" 의 기준선이 못 된다 */
    private static final int MIN_SPEND_SAMPLES = 2;

    private TradeRiskFeatureVector() {
    }

    static Map<String, Object> of(TradeRiskContext ctx) {
        Map<String, Object> f = new LinkedHashMap<>();

        // 거래 자체
        f.put("isAuction", ctx.isAuction());

        // 관계 — 판매자와 구매자
        f.put("sellerBuyerSameIp", ctx.seller().sameIp(ctx.buyer()));
        f.put("sellerBuyerSameUserAgent", ctx.seller().sameUserAgent(ctx.buyer()));
        f.put("sellerBuyerSamePhone", ctx.seller().samePhone(ctx.buyer()));
        f.put("buyerHasDevice", ctx.buyer().hasDevice());
        f.put("sellerHasDevice", ctx.seller().hasDevice());

        // 관계 — 2위 입찰자 (경매만)
        boolean hasRunnerUp = ctx.hasRunnerUp();
        f.put("hasRunnerUp", hasRunnerUp);
        f.put("sellerRunnerUpSameIp", hasRunnerUp && ctx.seller().sameIp(ctx.runnerUp()));
        f.put("sellerRunnerUpSameUserAgent", hasRunnerUp && ctx.seller().sameUserAgent(ctx.runnerUp()));
        f.put("sellerRunnerUpSamePhone", hasRunnerUp && ctx.seller().samePhone(ctx.runnerUp()));

        // 거래쌍·순환
        f.put("pairTradeCountLog", log1p(ctx.pairTradeCount()));
        f.put("photocardCycled", ctx.photocardCycled());

        // 시세 — 배율만 남긴다. price·medianPrice 원본은 넣지 않는다
        boolean priceComparable = ctx.designTradesInWindow() >= MIN_PRICE_SAMPLES;
        f.put("priceRatio", priceComparable ? ratio(ctx.price(), ctx.medianPrice()) : null);
        f.put("hasPriceReference", priceComparable && ctx.medianPrice() != null && ctx.medianPrice() > 0);

        // 거래량 — 개수는 로그로 눌러 넣는다. 시장이 커져도 뜻이 흔들리지 않게
        f.put("recentVolumeLog", log1p(ctx.recentVolume()));
        f.put("baselineVolumeLog", log1p(ctx.baselineVolume()));
        f.put("partyVolumeShare", ctx.recentVolume() < MIN_VOLUME_SAMPLES ? null
                : share(ctx.recentVolumeWithParties(), ctx.recentVolume()));

        // 매집 — 지분(비율)이 본체다
        f.put("designIssuedSupplyLog", log1p(ctx.designIssuedSupply()));
        f.put("ownedShareAfter", ctx.designIssuedSupply() < MIN_SUPPLY_FOR_SHARE ? null
                : share(ctx.buyerOwnedOfDesignAfter(), ctx.designIssuedSupply()));
        f.put("designTradesInWindowLog", log1p(ctx.designTradesInWindow()));
        f.put("buyShareAfter", ctx.designTradesInWindow() < MIN_DESIGN_TRADES_FOR_BUY_SHARE ? null
                : share(ctx.buyerBuysOfDesignInWindow() + 1, ctx.designTradesInWindow() + 1));

        // 계정 나이 — 분 단위 원본은 서비스가 오래될수록 커진다. 임계 판정만 남긴다
        f.put("buyerIsNewAccount", isNew(ctx.buyer().createdAt(), ctx.requestAt()));
        f.put("sellerIsNewAccount", isNew(ctx.seller().createdAt(), ctx.requestAt()));
        f.put("buyerHasDeposit", ctx.buyerFirstDepositAt() != null);
        f.put("minutesSinceFirstDeposit", minutesBetween(ctx.buyerFirstDepositAt(), ctx.requestAt()));

        // 단말 이력 · 지출 — 배율만. buyerMaxSpendInWindow 원본은 넣지 않는다
        f.put("buyerPriorDeviceLoginsLog", log1p(ctx.buyerPriorDeviceLogins()));
        f.put("minutesSinceDeviceFirstLogin", minutesBetween(ctx.buyerDeviceFirstLoginAt(), ctx.requestAt()));
        f.put("buyerDeviceSeenBefore", ctx.buyerDeviceFirstLoginAt() != null);
        boolean spendComparable = ctx.buyerPurchaseCountInWindow() >= MIN_SPEND_SAMPLES;
        f.put("spendRatio", spendComparable ? ratio(ctx.price(), ctx.buyerMaxSpendInWindow()) : null);
        f.put("hasSpendHistory", spendComparable
                && ctx.buyerMaxSpendInWindow() != null && ctx.buyerMaxSpendInWindow() > 0);

        // 그래프 — 거래를 이어 놓아야 보이는 것 (14-2-2)
        TradeRiskContext.Graph g = ctx.graph();
        f.put("buyerPreviouslyOwnedCard", g.buyerPreviouslyOwnedCard());
        f.put("cardTradesInWindowLog", log1p(g.cardTradesInWindow()));
        f.put("cardOwnerReuseRatio", g.cardTradesInWindow() == 0 ? null
                : round(1.0 - (double) g.cardDistinctOwnersInWindow() / g.cardTradesInWindow()));
        f.put("buyerToSellerHops", g.buyerToSellerHops());
        f.put("buyerReachesSeller", g.buyerToSellerHops() != null);

        // 꾸밈 — 가격이 아니라 행동을 본다 (14-2-3)
        TradeRiskContext.Decoration d = ctx.decoration();
        f.put("hasDecoration", d.present());
        f.put("stickerCountLog", log1p(d.stickerCount()));
        f.put("minutesSinceDecoration", d.minutesSinceDecoration());
        f.put("decoratedBySeller", d.decoratedBySeller());

        // 속도 — 금액을 전혀 보지 않는 축 (금융권 FDS 의 기본)
        TradeRiskContext.Velocity v = ctx.velocity();
        f.put("buyerTrades10mLog", log1p(v.buyerTrades10m()));
        f.put("buyerTrades1hLog", log1p(v.buyerTrades1h()));
        f.put("sellerTrades10mLog", log1p(v.sellerTrades10m()));
        f.put("sellerTrades1hLog", log1p(v.sellerTrades1h()));
        f.put("cardHandoffs24hLog", log1p(v.cardHandoffs24h()));

        return f;
    }

    /**
     * 개수를 로그로 누른다. 거래가 10건인 시장과 10만건인 시장에서 같은 자릿수 차이가
     * 같은 크기로 보이게 하려는 것이다 — 원본 개수를 그대로 넣으면 시장이 커질 때 이 피처 하나가
     * 점수를 독점한다(2026-09-23 dev 회귀).
     */
    private static double log1p(int count) {
        return round(Math.log1p(Math.max(0, count)));
    }

    /** R5 와 같은 기준(24시간)으로 "갓 만든 계정" 만 표시한다. 분 단위 원본은 서비스 나이를 따라 커진다 */
    private static Boolean isNew(LocalDateTime createdAt, LocalDateTime requestAt) {
        Long minutes = minutesBetween(createdAt, requestAt);
        return minutes == null ? null : minutes <= Duration.ofHours(24).toMinutes();
    }

    /** 분모가 없거나 0 이면 null — 0 으로 채우면 "비율 0" 과 "알 수 없음" 이 섞인다 */
    private static Double ratio(long numerator, Long denominator) {
        if (denominator == null || denominator <= 0) {
            return null;
        }
        return round((double) numerator / denominator);
    }

    private static Double share(int numerator, int denominator) {
        if (denominator <= 0) {
            return null;
        }
        return round((double) numerator / denominator);
    }

    private static Long minutesBetween(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null) {
            return null;
        }
        return Duration.between(from, to).toMinutes();
    }

    private static double round(double value) {
        return Math.round(value * 10_000) / 10_000.0;
    }
}
