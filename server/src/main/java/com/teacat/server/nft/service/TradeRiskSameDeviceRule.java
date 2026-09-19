package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * R1 — 판매자와 구매자(경매면 2위 입찰자도)가 같은 단말에서 요청했다.
 * IP 만 같으면 MEDIUM(같은 공용망일 수 있다), UA 해시까지 같으면 HIGH. shill bidding 의 가장 직접적인 신호다.
 */
@Component
public class TradeRiskSameDeviceRule implements TradeRiskRule {

    public static final String CODE = "R1_SAME_DEVICE";

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public List<NftTradeRiskSignal> evaluate(TradeRiskContext ctx, NftTradeReviewProperties p) {
        List<NftTradeRiskSignal> signals = new ArrayList<>();
        check(ctx.seller(), ctx.buyer(), "buyer", signals);
        if (ctx.hasRunnerUp()) {
            check(ctx.seller(), ctx.runnerUp(), "runnerUp", signals);
        }
        return signals;
    }

    private void check(TradeRiskContext.Party seller, TradeRiskContext.Party counterpart, String label,
                       List<NftTradeRiskSignal> out) {
        if (!seller.sameIp(counterpart)) {
            return;
        }
        boolean sameUa = seller.sameUserAgent(counterpart);
        out.add(new NftTradeRiskSignal(CODE, sameUa ? NftReviewSeverity.HIGH : NftReviewSeverity.MEDIUM,
                Map.of("counterpart", label, "counterpartUserId", counterpart.id(),
                        "ipMatch", true, "userAgentMatch", sameUa)));
    }
}
