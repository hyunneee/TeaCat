package com.teacat.server.nft.service;

import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;

import java.util.List;
import java.util.Map;

/**
 * 규칙 전체를 돌린 결과. <b>HIGH 가 하나라도 있거나 MEDIUM 이 둘 이상이면 보류</b>(flagged).
 * MEDIUM 하나는 기록만 남기고 정산을 막지 않는다 — 정상 거래도 규칙 하나에는 흔히 걸린다.
 *
 * @param features 학습용 피처 벡터(AUCTION_FRAUD_DESIGN.md 14-2). 맥락 없이 신호만 평가했으면 빈 맵이다.
 *                 <b>신호가 없어도 채워진다</b> — 통과한 거래의 피처가 모델의 정상 사례가 된다
 * @param modelScore   섀도우 모델의 부정 확률 0~1 (14-3). 모델이 없거나 채점이 실패하면 null.
 *                     <b>아무 분기도 이 값을 읽지 않는다</b> — 저장만 된다
 * @param modelVersion 그 점수를 낸 모델 판. 모델을 바꾼 뒤 예전 점수와 섞이지 않게 한다
 */
public record TradeRiskAssessment(List<NftTradeRiskSignal> signals, NftReviewSeverity maxSeverity, boolean flagged,
                                  Map<String, Object> features, Double modelScore, String modelVersion) {

    private static final TradeRiskAssessment CLEAR =
            new TradeRiskAssessment(List.of(), null, false, Map.of(), null, null);

    public static TradeRiskAssessment clear() {
        return CLEAR;
    }

    public static TradeRiskAssessment of(List<NftTradeRiskSignal> signals) {
        return of(signals, Map.of(), null, null);
    }

    public static TradeRiskAssessment of(List<NftTradeRiskSignal> signals, Map<String, Object> features,
                                         Double modelScore, String modelVersion) {
        if (signals == null || signals.isEmpty()) {
            return new TradeRiskAssessment(List.of(), null, false, features, modelScore, modelVersion);
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
        return new TradeRiskAssessment(List.copyOf(signals), max, flagged, features, modelScore, modelVersion);
    }

    public List<String> ruleCodes() {
        return signals.stream().map(NftTradeRiskSignal::rule).toList();
    }

    /** 피처가 만들어졌나. 심사가 꺼져 있거나 맥락을 못 읽으면 비어 있다 */
    public boolean hasFeatures() {
        return !features.isEmpty();
    }
}
