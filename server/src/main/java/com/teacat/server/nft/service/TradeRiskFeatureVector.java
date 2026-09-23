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

    private TradeRiskFeatureVector() {
    }

    static Map<String, Object> of(TradeRiskContext ctx) {
        Map<String, Object> f = new LinkedHashMap<>();

        // 거래 자체
        f.put("isAuction", ctx.isAuction());
        f.put("price", ctx.price());

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
        f.put("pairTradeCount", ctx.pairTradeCount());
        f.put("photocardCycled", ctx.photocardCycled());

        // 시세
        f.put("medianPrice", ctx.medianPrice());
        f.put("priceSamples", ctx.priceSamples());
        f.put("priceRatio", ratio(ctx.price(), ctx.medianPrice()));

        // 거래량
        f.put("recentVolume", ctx.recentVolume());
        f.put("recentVolumeWithParties", ctx.recentVolumeWithParties());
        f.put("baselineVolume", ctx.baselineVolume());
        f.put("partyVolumeShare", share(ctx.recentVolumeWithParties(), ctx.recentVolume()));

        // 매집
        f.put("designIssuedSupply", ctx.designIssuedSupply());
        f.put("buyerOwnedOfDesign", ctx.buyerOwnedOfDesign());
        f.put("ownedShareAfter", share(ctx.buyerOwnedOfDesignAfter(), ctx.designIssuedSupply()));
        f.put("designTradesInWindow", ctx.designTradesInWindow());
        f.put("buyerBuysOfDesignInWindow", ctx.buyerBuysOfDesignInWindow());
        f.put("buyShareAfter", share(ctx.buyerBuysOfDesignInWindow() + 1, ctx.designTradesInWindow() + 1));

        // 계정 나이 · 충전
        f.put("buyerAccountAgeMinutes", minutesBetween(ctx.buyer().createdAt(), ctx.requestAt()));
        f.put("sellerAccountAgeMinutes", minutesBetween(ctx.seller().createdAt(), ctx.requestAt()));
        f.put("minutesSinceFirstDeposit", minutesBetween(ctx.buyerFirstDepositAt(), ctx.requestAt()));
        f.put("buyerHasDeposit", ctx.buyerFirstDepositAt() != null);

        // 단말 이력 · 지출
        f.put("buyerPriorDeviceLogins", ctx.buyerPriorDeviceLogins());
        f.put("minutesSinceDeviceFirstLogin", minutesBetween(ctx.buyerDeviceFirstLoginAt(), ctx.requestAt()));
        f.put("buyerDeviceSeenBefore", ctx.buyerDeviceFirstLoginAt() != null);
        f.put("buyerMaxSpendInWindow", ctx.buyerMaxSpendInWindow());
        f.put("spendRatio", ratio(ctx.price(), ctx.buyerMaxSpendInWindow()));

        // 그래프 — 거래를 이어 놓아야 보이는 것 (14-2-2). 규칙 R1~R8 은 이 값을 읽지 않는다
        TradeRiskContext.Graph g = ctx.graph();
        f.put("buyerPreviouslyOwnedCard", g.buyerPreviouslyOwnedCard());
        f.put("cardTradesInWindow", g.cardTradesInWindow());
        f.put("cardDistinctOwnersInWindow", g.cardDistinctOwnersInWindow());
        // 손바뀜은 잦은데 주인이 적으면 같은 사람들 사이를 도는 것이다. 1에 가까울수록 고리
        f.put("cardOwnerReuseRatio", g.cardTradesInWindow() == 0 ? null
                : round(1.0 - (double) g.cardDistinctOwnersInWindow() / g.cardTradesInWindow()));
        f.put("buyerToSellerHops", g.buyerToSellerHops());
        f.put("buyerReachesSeller", g.buyerToSellerHops() != null);

        return f;
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
