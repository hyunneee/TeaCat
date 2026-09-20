package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftTradeRiskSignal;
import com.teacat.server.nft.repository.NftTradeRiskQueryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 이상거래 규칙 R1~R8 을 거래 하나에 돌려 {@link TradeRiskAssessment} 를 만든다 (AUCTION_FRAUD_DESIGN.md 5장).
 *
 * <p>트랜잭션을 열지 않는다 — 정산 Writer 의 짧은 DB 트랜잭션에 합류한다. 스스로는 아무것도 바꾸지 않는다.
 * {@code nft.trade.review.enabled=false} 면 빈 결과를 돌려 정산이 예전과 똑같이 흐른다.
 */
@Slf4j
@Component
public class NftTradeRiskScreener {

    private final NftTradeRiskQueryRepository queryRepository;
    private final List<TradeRiskRule> rules;
    private final NftTradeReviewProperties properties;

    public NftTradeRiskScreener(NftTradeRiskQueryRepository queryRepository, List<TradeRiskRule> rules,
                                NftTradeReviewProperties properties) {
        this.queryRepository = queryRepository;
        // 규칙 순서가 결정적이어야 signals 배열 순서가 재현된다 (테스트·화면)
        this.rules = rules.stream().sorted(Comparator.comparing(TradeRiskRule::code)).toList();
        this.properties = properties;
    }

    public TradeRiskAssessment screen(Long tradeId) {
        if (!properties.enabled()) {
            return TradeRiskAssessment.clear();
        }
        TradeRiskContext context = queryRepository.loadContext(tradeId, properties).orElse(null);
        if (context == null) {
            log.warn("이상거래 심사 대상 거래를 찾지 못했습니다 tradeId={}", tradeId);
            return TradeRiskAssessment.clear();
        }
        return evaluate(context);
    }

    /** 맥락이 이미 있을 때(단위 테스트·시뮬레이션). 규칙만 돌린다 */
    public TradeRiskAssessment evaluate(TradeRiskContext context) {
        List<NftTradeRiskSignal> signals = new ArrayList<>();
        for (TradeRiskRule rule : rules) {
            signals.addAll(rule.evaluate(context, properties));
        }
        return TradeRiskAssessment.of(signals);
    }
}
