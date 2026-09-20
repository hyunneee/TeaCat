package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * R5 — 갓 가입한 계정이 첫 충전 직후 바로 돈을 건다. 일회용 계정의 모양이다.
 * 관리자 지급(ADMIN_GRANT)은 충전으로 세지 않으므로, QA 계정은 여기에 걸리지 않는다.
 */
@Component
public class TradeRiskNewAccountRushRule implements TradeRiskRule {

    public static final String CODE = "R5_NEW_ACCOUNT_RUSH";

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public List<NftTradeRiskSignal> evaluate(TradeRiskContext ctx, NftTradeReviewProperties p) {
        TradeRiskContext.Party buyer = ctx.buyer();
        if (buyer.createdAt() == null || ctx.requestAt() == null || ctx.buyerFirstDepositAt() == null) {
            return List.of();
        }
        Duration accountAge = Duration.between(buyer.createdAt(), ctx.requestAt());
        if (accountAge.isNegative() || accountAge.compareTo(p.newAccountAge()) > 0) {
            return List.of();
        }
        Duration sinceDeposit = Duration.between(ctx.buyerFirstDepositAt(), ctx.requestAt());
        if (sinceDeposit.isNegative() || sinceDeposit.compareTo(p.depositToBid()) > 0) {
            return List.of();
        }
        return List.of(new NftTradeRiskSignal(CODE, NftReviewSeverity.MEDIUM,
                Map.of("accountAgeMinutes", accountAge.toMinutes(),
                        "minutesSinceFirstDeposit", sinceDeposit.toMinutes(),
                        "newAccountAgeHours", p.newAccountAge().toHours(),
                        "depositToBidMinutes", p.depositToBid().toMinutes())));
    }
}
