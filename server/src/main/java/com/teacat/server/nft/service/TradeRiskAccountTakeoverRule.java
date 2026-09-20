package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * R8 — 계정 탈취 의심. 세 조건을 전부 만족해야 한다(오탐 때문이다 — 새 폰을 산 사용자가 평소 금액으로 사는 건 잡지 않는다).
 * <ol>
 *   <li>구매자 계정에 다른 단말의 로그인 이력이 있고, 요청 단말은 그 이력에 없거나 첫 로그인이 요청 직전이다</li>
 *   <li>거래가가 그 계정의 최근 최대 지출의 몇 배다</li>
 * </ol>
 * 판매자 계정 탈취는 보지 않는다 — 카드가 팔릴 뿐 돈이 빠지지는 않는다. 로그인 이력이 없는 계정은 판단 불가다.
 */
@Component
public class TradeRiskAccountTakeoverRule implements TradeRiskRule {

    public static final String CODE = "R8_ACCOUNT_TAKEOVER";

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public List<NftTradeRiskSignal> evaluate(TradeRiskContext ctx, NftTradeReviewProperties p) {
        if (!ctx.buyer().hasDevice() || ctx.requestAt() == null) {
            return List.of();
        }
        if (ctx.buyerPriorDeviceLogins() <= 0) {
            return List.of(); // 다른 단말 이력이 없으면 "처음 보는 단말" 을 말할 수 없다
        }
        Long deviceMinutes = null;
        if (ctx.buyerDeviceFirstLoginAt() != null) {
            Duration sinceFirstLogin = Duration.between(ctx.buyerDeviceFirstLoginAt(), ctx.requestAt());
            if (sinceFirstLogin.isNegative() || sinceFirstLogin.compareTo(p.takeoverFirstLoginToBid()) > 0) {
                return List.of(); // 이 단말을 오래 써 왔다
            }
            deviceMinutes = sinceFirstLogin.toMinutes();
        }
        Long maxSpend = ctx.buyerMaxSpendInWindow();
        if (maxSpend == null || maxSpend <= 0) {
            return List.of(); // 평소 지출을 모르면 "몇 배" 를 말할 수 없다
        }
        double ratio = (double) ctx.price() / maxSpend;
        if (ratio < p.takeoverSpendMultiplier()) {
            return List.of();
        }
        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("newDevice", true);
        evidence.put("priorDeviceLogins", ctx.buyerPriorDeviceLogins());
        evidence.put("minutesSinceDeviceFirstLogin", deviceMinutes); // null 이면 이 단말 로그인 기록 자체가 없다
        evidence.put("price", ctx.price());
        evidence.put("recentMaxSpend", maxSpend);
        evidence.put("ratio", Math.round(ratio * 100) / 100.0);
        evidence.put("threshold", p.takeoverSpendMultiplier());
        return List.of(new NftTradeRiskSignal(CODE, NftReviewSeverity.HIGH, evidence));
    }
}
