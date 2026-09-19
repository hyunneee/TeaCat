package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * R3 — 같은 두 계정이 반복해서 거래한다(MEDIUM), 또는 같은 카드가 두 계정 사이를 되돌아온다 A→B→A (HIGH).
 * 계정 사이에 돈을 옮기는 통로의 가장 단순한 모양이다. 세 계정 이상을 거치는 순환은 잡지 않는다(설계 13장 6번).
 */
@Component
public class TradeRiskRepeatedPairRule implements TradeRiskRule {

    public static final String CODE = "R3_REPEATED_PAIR";

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public List<NftTradeRiskSignal> evaluate(TradeRiskContext ctx, NftTradeReviewProperties p) {
        List<NftTradeRiskSignal> signals = new ArrayList<>();
        if (ctx.photocardCycled()) {
            signals.add(new NftTradeRiskSignal(CODE, NftReviewSeverity.HIGH,
                    Map.of("photocardCycled", true, "photocardId", ctx.photocardId(),
                            "pairTrades", ctx.pairTradeCount(), "windowDays", p.pairWindow().toDays())));
            return signals;
        }
        if (ctx.pairTradeCount() >= p.pairThreshold()) {
            signals.add(new NftTradeRiskSignal(CODE, NftReviewSeverity.MEDIUM,
                    Map.of("photocardCycled", false, "pairTrades", ctx.pairTradeCount(),
                            "threshold", p.pairThreshold(), "windowDays", p.pairWindow().toDays())));
        }
        return signals;
    }
}
