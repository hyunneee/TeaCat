package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.nft.entity.NftReviewSeverity;
import com.teacat.server.nft.entity.NftTradeRiskSignal;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * R4 — 거래가가 같은 도안 최근 거래가 중앙값의 몇 배다. 표본이 적으면 판단하지 않는다 —
 * 첫 거래 몇 건은 시세가 없어서 무엇이든 "이상" 이 된다.
 */
@Component
public class TradeRiskPriceOutlierRule implements TradeRiskRule {

    public static final String CODE = "R4_PRICE_OUTLIER";

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public List<NftTradeRiskSignal> evaluate(TradeRiskContext ctx, NftTradeReviewProperties p) {
        // 🔴 꾸민 카드는 판단하지 않는다. 잘 꾸민 카드가 시세보다 비싼 것은 정상이고,
        //    그걸 매번 걸면 애써 꾸민 사람이 심사에 올라온다. 표본 부족일 때 빠지는 것과 같은 이유다.
        //    ⚠️ 대신 꾸밈은 가격 조작의 알리바이가 된다 — 그쪽은 가격이 아니라 행동으로 본다
        //       (꾸민 뒤 얼마 만에 파는가, 꾸민 사람이 파는 사람인가). 설계문서 14-2-3.
        if (ctx.decoration().present()) {
            return List.of();
        }
        if (ctx.medianPrice() == null || ctx.medianPrice() <= 0 || ctx.designTradesInWindow() < p.priceMinSamples()) {
            return List.of();
        }
        double ratio = (double) ctx.price() / ctx.medianPrice();
        if (ratio < p.priceMultiplier()) {
            return List.of();
        }
        return List.of(new NftTradeRiskSignal(CODE, NftReviewSeverity.MEDIUM,
                Map.of("price", ctx.price(), "medianPrice", ctx.medianPrice(), "samples", ctx.designTradesInWindow(),
                        "ratio", Math.round(ratio * 100) / 100.0, "threshold", p.priceMultiplier(),
                        "windowDays", p.priceWindow().toDays())));
    }
}
