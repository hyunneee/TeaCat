package com.teacat.server.nft.service;

import java.util.Map;

/**
 * 피처 이름을 관리자가 읽을 말로 바꾼다 (AUCTION_FRAUD_DESIGN.md 14-3 설명 화면).
 *
 * <p>모델 점수만 보여주면 관리자는 "그래서 왜?" 를 물을 수밖에 없다. 로지스틱 회귀는 점수가
 * 각 피처 기여의 단순 합이라 한 항씩 떼어 보여줄 수 있는데, 그러려면 {@code buyerToSellerHops}
 * 같은 이름이 아니라 <b>사람이 읽는 문장</b>이어야 한다.
 *
 * <p>⚠️ {@link TradeRiskFeatureVector} 에 피처를 더하면 여기도 함께 늘린다. 빠뜨리면 화면에
 * 원본 이름이 그대로 나가고, 그건 관리자에게 아무 뜻도 전달하지 못한다.
 * 빠뜨려도 동작은 하므로(이름을 그대로 돌려준다) 테스트가 지킨다.
 */
final class TradeRiskFeatureLabels {

    private static final Map<String, String> LABELS = Map.ofEntries(
            // 거래 자체
            Map.entry("isAuction", "경매로 성립한 거래"),

            // 관계 — 판매자와 구매자
            Map.entry("sellerBuyerSameIp", "판매자와 구매자가 같은 IP"),
            Map.entry("sellerBuyerSameUserAgent", "판매자와 구매자가 같은 브라우저"),
            Map.entry("sellerBuyerSamePhone", "판매자와 구매자가 같은 전화번호"),
            Map.entry("buyerHasDevice", "구매자 단말 정보가 있음"),
            Map.entry("sellerHasDevice", "판매자 단말 정보가 있음"),

            // 관계 — 2위 입찰자
            Map.entry("hasRunnerUp", "2위 입찰자가 있음"),
            Map.entry("sellerRunnerUpSameIp", "판매자와 2위 입찰자가 같은 IP"),
            Map.entry("sellerRunnerUpSameUserAgent", "판매자와 2위 입찰자가 같은 브라우저"),
            Map.entry("sellerRunnerUpSamePhone", "판매자와 2위 입찰자가 같은 전화번호"),

            // 거래쌍·순환
            Map.entry("pairTradeCountLog", "두 사람이 전에도 거래한 횟수"),
            Map.entry("photocardCycled", "이 카드가 두 사람 사이를 오간 적 있음"),

            // 시세
            Map.entry("priceRatio", "시세 대비 거래가 배율"),
            Map.entry("hasPriceReference", "비교할 시세가 있음"),

            // 거래량
            Map.entry("recentVolumeLog", "이 도안의 최근 거래량"),
            Map.entry("baselineVolumeLog", "이 도안의 평소 거래량"),
            Map.entry("partyVolumeShare", "최근 거래 중 두 사람이 낀 비율"),

            // 매집
            Map.entry("designIssuedSupplyLog", "이 도안의 발행량"),
            Map.entry("ownedShareAfter", "거래 후 구매자가 갖는 도안 지분"),
            Map.entry("designTradesInWindowLog", "이 도안의 기간 내 거래 수"),
            Map.entry("buyShareAfter", "최근 이 도안 거래 중 구매자가 산 비율"),

            // 계정 나이 · 충전
            Map.entry("buyerIsNewAccount", "구매자가 가입 24시간 안의 계정"),
            Map.entry("sellerIsNewAccount", "판매자가 가입 24시간 안의 계정"),
            Map.entry("buyerHasDeposit", "구매자에게 충전 이력이 있음"),
            Map.entry("minutesSinceFirstDeposit", "첫 충전 후 지난 시간"),

            // 단말 이력 · 지출
            Map.entry("buyerPriorDeviceLoginsLog", "구매자의 다른 단말 로그인 수"),
            Map.entry("minutesSinceDeviceFirstLogin", "이 단말 첫 로그인 후 지난 시간"),
            Map.entry("buyerDeviceSeenBefore", "이 단말로 로그인한 적 있음"),
            Map.entry("spendRatio", "평소 최대 지출 대비 배율"),
            Map.entry("hasSpendHistory", "구매자에게 구매 이력이 있음"),

            // 그래프
            Map.entry("buyerPreviouslyOwnedCard", "구매자가 이 카드를 전에 가진 적 있음"),
            Map.entry("cardTradesInWindowLog", "이 카드의 최근 손바뀜 횟수"),
            Map.entry("cardOwnerReuseRatio", "손바뀜 대비 주인이 적은 정도"),
            Map.entry("buyerToSellerHops", "거래망에서 구매자가 판매자에 닿는 거리"),
            Map.entry("buyerReachesSeller", "거래망에서 구매자가 판매자에 닿음"),

            // 꾸밈
            Map.entry("hasDecoration", "꾸며진 카드"),
            Map.entry("stickerCountLog", "붙은 스티커 수"),
            Map.entry("minutesSinceDecoration", "꾸민 뒤 판매까지 걸린 시간"),
            Map.entry("decoratedBySeller", "꾸민 사람이 판매자와 같음"),

            // 속도
            Map.entry("buyerTrades10mLog", "구매자의 최근 10분 구매 건수"),
            Map.entry("buyerTrades1hLog", "구매자의 최근 1시간 구매 건수"),
            Map.entry("sellerTrades10mLog", "판매자의 최근 10분 판매 건수"),
            Map.entry("sellerTrades1hLog", "판매자의 최근 1시간 판매 건수"),
            Map.entry("cardHandoffs24hLog", "이 카드의 최근 24시간 손바뀜 횟수"));

    private TradeRiskFeatureLabels() {
    }

    /** 표에 없으면 원본 이름을 그대로 돌려준다 — 화면이 비는 것보다는 낫다 */
    static String of(String feature) {
        return LABELS.getOrDefault(feature, feature);
    }

    static boolean has(String feature) {
        return LABELS.containsKey(feature);
    }
}
