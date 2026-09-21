package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * R2 — 판매자와 구매자(경매면 2위 입찰자도)의 전화번호가 같다. 전화번호는 UNIQUE 가 아니라서 한 사람이 계정을 여럿 만들 수 있다.
 * 번호 원문은 evidence 에 넣지 않는다.
 */
@Component
public class TradeRiskSamePhoneRule implements TradeRiskRule {

    public static final String CODE = "R2_SAME_PHONE";

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public List<NftTradeRiskSignal> evaluate(TradeRiskContext ctx, NftTradeReviewProperties p) {
        List<NftTradeRiskSignal> signals = new ArrayList<>();
        if (ctx.seller().samePhone(ctx.buyer())) {
            signals.add(signal("buyer", ctx.buyer().id()));
        }
        if (ctx.hasRunnerUp() && ctx.seller().samePhone(ctx.runnerUp())) {
            signals.add(signal("runnerUp", ctx.runnerUp().id()));
        }
        return signals;
    }

    private NftTradeRiskSignal signal(String label, Long counterpartId) {
        return new NftTradeRiskSignal(CODE, NftReviewSeverity.HIGH,
                Map.of("counterpart", label, "counterpartUserId", counterpartId, "phoneMatch", true));
    }
}
