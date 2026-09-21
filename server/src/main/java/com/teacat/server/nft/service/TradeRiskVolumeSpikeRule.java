package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * R6 — 같은 도안의 거래가 갑자기 몰리고, 그 거래의 절반 이상에 이 거래의 당사자가 끼어 있다.
 * 시장이 작아 몇 명이 시세를 만들 수 있다. 기준 기간 거래가 너무 적으면 판단하지 않는다.
 */
@Component
public class TradeRiskVolumeSpikeRule implements TradeRiskRule {

    public static final String CODE = "R6_VOLUME_SPIKE";

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public List<NftTradeRiskSignal> evaluate(TradeRiskContext ctx, NftTradeReviewProperties p) {
        if (ctx.baselineVolume() < p.volumeMinBaseline() || p.volumeBaselineWeeks() <= 0 || ctx.recentVolume() <= 0) {
            return List.of();
        }
        double weeklyAverage = (double) ctx.baselineVolume() / p.volumeBaselineWeeks();
        if (weeklyAverage <= 0 || ctx.recentVolume() < weeklyAverage * p.volumeMultiplier()) {
            return List.of();
        }
        if (ctx.recentVolumeWithParties() * 2 < ctx.recentVolume()) {
            return List.of();
        }
        return List.of(new NftTradeRiskSignal(CODE, NftReviewSeverity.MEDIUM,
                Map.of("recentTrades", ctx.recentVolume(), "recentTradesWithParties", ctx.recentVolumeWithParties(),
                        "baselineWeeklyAverage", Math.round(weeklyAverage * 100) / 100.0,
                        "threshold", p.volumeMultiplier(), "windowDays", p.volumeWindow().toDays())));
    }
}
