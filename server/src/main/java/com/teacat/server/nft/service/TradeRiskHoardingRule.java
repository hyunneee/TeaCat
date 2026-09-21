package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * R7 — 한 계정이 특정 도안을 쓸어 모은다. 이 거래로 발행량의 일정 비율 이상을 갖게 되거나,
 * 최근 그 도안 거래의 절반 이상을 혼자 사들였으면 신호. 발행량이 적은 도안은 정상 수집가도 쉽게 넘어 판단하지 않는다.
 */
@Component
public class TradeRiskHoardingRule implements TradeRiskRule {

    public static final String CODE = "R7_HOARDING";
    private static final int MIN_DESIGN_TRADES_FOR_BUY_SHARE = 3;

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public List<NftTradeRiskSignal> evaluate(TradeRiskContext ctx, NftTradeReviewProperties p) {
        if (ctx.designIssuedSupply() < p.hoardMinSupply()) {
            return List.of();
        }
        double shareAfter = (double) ctx.buyerOwnedOfDesignAfter() / ctx.designIssuedSupply();
        boolean bySupply = shareAfter >= p.hoardShare();

        boolean byBuys = false;
        double buyShare = 0;
        if (ctx.designTradesInWindow() >= MIN_DESIGN_TRADES_FOR_BUY_SHARE) {
            buyShare = (double) (ctx.buyerBuysOfDesignInWindow() + 1) / (ctx.designTradesInWindow() + 1);
            byBuys = buyShare >= p.hoardBuyShare();
        }
        if (!bySupply && !byBuys) {
            return List.of();
        }
        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("designId", ctx.designId());
        evidence.put("issuedSupply", ctx.designIssuedSupply());
        evidence.put("ownedAfterTrade", ctx.buyerOwnedOfDesignAfter());
        evidence.put("ownedShareAfter", Math.round(shareAfter * 100) / 100.0);
        evidence.put("bySupplyShare", bySupply);
        evidence.put("designTradesInWindow", ctx.designTradesInWindow());
        evidence.put("buyerBuysInWindow", ctx.buyerBuysOfDesignInWindow());
        evidence.put("buyShareAfter", Math.round(buyShare * 100) / 100.0);
        evidence.put("byBuyShare", byBuys);
        return List.of(new NftTradeRiskSignal(CODE, NftReviewSeverity.MEDIUM, evidence));
    }
}
