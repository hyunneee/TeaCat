package com.teacat.server.nft.service;

import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;

import java.util.List;

/**
 * 규칙 전체를 돌린 결과. <b>HIGH 가 하나라도 있거나 MEDIUM 이 둘 이상이면 보류</b>(flagged).
 * MEDIUM 하나는 기록만 남기고 정산을 막지 않는다 — 정상 거래도 규칙 하나에는 흔히 걸린다.
 */
public record TradeRiskAssessment(List<NftTradeRiskSignal> signals, NftReviewSeverity maxSeverity, boolean flagged) {

    private static final TradeRiskAssessment CLEAR = new TradeRiskAssessment(List.of(), null, false);

    public static TradeRiskAssessment clear() {
        return CLEAR;
    }

    public static TradeRiskAssessment of(List<NftTradeRiskSignal> signals) {
        if (signals == null || signals.isEmpty()) {
            return CLEAR;
        }
        NftReviewSeverity max = null;
        int mediums = 0;
        for (NftTradeRiskSignal signal : signals) {
            max = NftReviewSeverity.max(max, signal.severity());
            if (signal.severity() == NftReviewSeverity.MEDIUM) {
                mediums++;
            }
        }
        boolean flagged = max == NftReviewSeverity.HIGH || mediums >= 2;
        return new TradeRiskAssessment(List.copyOf(signals), max, flagged);
    }

    public List<String> ruleCodes() {
        return signals.stream().map(NftTradeRiskSignal::rule).toList();
    }
}
