package com.teacat.server.nft.service;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * 이상거래 규칙이 보는 거래 한 건의 맥락. {@code NftTradeRiskQueryRepository} 가 한 번 만들어 모든 규칙에 넘긴다 —
 * 규칙마다 따로 조회하지 않는다. 규칙은 이 값만 읽는 순수 함수에 가깝다.
 *
 * <p>"구매자" 는 자연 낙찰이면 최고 입찰자, 즉시구매·고정가면 구매 요청자다. "2위 입찰자" 는 경매에만 있다.
 * 알 수 없는 값은 null 이고, 규칙은 null 을 "판단 불가" 로 본다.
 *
 * @param requestAt                  구매자가 돈을 걸기로 한 시각 — 경매면 이 경매의 첫 입찰, 즉시구매·고정가면 구매 요청
 * @param pairTradeCount             기간 안 판매자·구매자(순서 무관) 사이의 완료 거래 수
 * @param photocardCycled            이 카드가 이미 같은 두 계정 사이를 오간 적이 있나 (A→B→A)
 * @param medianPrice                같은 도안 최근 완료 거래가 중앙값. 표본 없으면 null
 * @param recentVolume               같은 도안 최근 기간(volume-window) 완료 거래 수
 * @param recentVolumeWithParties    그중 판매자 또는 구매자가 낀 것
 * @param baselineVolume             그 이전 기준 기간(volume-baseline-weeks) 완료 거래 수
 * @param designIssuedSupply         도안 발행량
 * @param buyerOwnedOfDesign         구매자가 지금 가진 같은 도안 카드 수 (이 거래 전)
 * @param designTradesInWindow       같은 도안 최근 기간(price-window) 완료 거래 수.
 *                                   <b>중앙값의 표본 수이기도 하다</b> — 같은 조회에서 나온 같은 값이라
 *                                   {@code priceSamples} 라는 이름으로 한 번 더 들고 있었는데, 모델을
 *                                   학습시켜 보니 두 피처의 계수가 완전히 같게 나와 중복이 드러났다
 * @param buyerBuysOfDesignInWindow  그중 구매자가 산 것
 * @param buyerFirstDepositAt        구매자의 첫 원화 충전(DEPOSIT) 시각. 없으면 null. ADMIN_GRANT 는 세지 않는다
 * @param buyerPriorDeviceLogins     요청 전 기간 안, 요청 단말과 <b>다른</b> 단말에서의 로그인 수
 * @param buyerDeviceFirstLoginAt    요청 단말에서의 첫 로그인 시각. 그 단말 로그인 기록이 없으면 null
 * @param buyerMaxSpendInWindow      구매자의 최근 기간 최대 구매가. 구매 이력 없으면 null
 * @param graph                      거래 그래프에서 본 구조. 규칙 R1~R8 은 아직 쓰지 않고 피처로만 나간다
 * @param decoration                 이 카드의 꾸밈 이력. R4 가 판단을 건너뛸지 정하고, 나머지는 피처로 나간다
 * @param velocity                   최근 짧은 창의 거래 빈도. 금융권 FDS 의 기본 축이다
 */
public record TradeRiskContext(
        Long tradeId,
        Source source,
        Long auctionId,
        Long listingId,
        long price,
        Long photocardId,
        Long designId,
        Party seller,
        Party buyer,
        Party runnerUp,
        LocalDateTime requestAt,
        int pairTradeCount,
        boolean photocardCycled,
        Long medianPrice,
        int recentVolume,
        int recentVolumeWithParties,
        int baselineVolume,
        int designIssuedSupply,
        int buyerOwnedOfDesign,
        int designTradesInWindow,
        int buyerBuysOfDesignInWindow,
        LocalDateTime buyerFirstDepositAt,
        int buyerPriorDeviceLogins,
        LocalDateTime buyerDeviceFirstLoginAt,
        Long buyerMaxSpendInWindow,
        Graph graph,
        Decoration decoration,
        Velocity velocity,
        LocalDateTime now
) {

    public enum Source { AUCTION, LISTING }

    /**
     * 거래를 <b>한 건씩</b> 보면 안 보이고 <b>이어 놓아야</b> 보이는 것들 (AUCTION_FRAUD_DESIGN.md 14-2-2).
     *
     * <p>왜 필요한가: 규칙 R3 의 순환 판정은 "이 두 사람 사이" 로 한정돼 있다. A→B→C→A 처럼 한 사람만
     * 더 끼면 마지막 구간에서 C 와 A 는 처음 거래하는 사이로 보인다. 시뮬레이터로 확인한 결과
     * 기존 피처 34개 중 <b>어느 것도</b> 3단 순환을 정상 거래와 구별하지 못했다 — 모델을 바꿔서 될 일이
     * 아니라 입력에 정보가 없었던 것이다.
     *
     * <p>🔴 이 값들은 <b>피처로만</b> 나간다. 규칙으로 승격하지 않는다 — 규칙으로 막으면 공격자가
     * 고리를 4단·5단으로 늘리는 순간 다시 뚫린다. 구조를 배우는 일은 모델이 할 몫이다.
     *
     * @param buyerPreviouslyOwnedCard    구매자가 이 카드를 <b>전에 가진 적</b> 있나. 고리 길이와 무관하게 되돌아옴을 잡는다
     * @param cardTradesInWindow          이 카드가 최근 기간에 손바뀜한 횟수
     * @param cardDistinctOwnersInWindow  그 사이 거쳐 간 서로 다른 주인 수. 손바뀜은 잦은데 주인이 적으면 고리다
     * @param buyerToSellerHops           거래 그래프에서 구매자 → … → 판매자 최단 경로. 닿지 않으면 null
     */
    public record Graph(boolean buyerPreviouslyOwnedCard, int cardTradesInWindow,
                        int cardDistinctOwnersInWindow, Integer buyerToSellerHops) {

        public static final Graph EMPTY = new Graph(false, 0, 0, null);
    }

    /**
     * 카드에 얹힌 꾸밈. 꾸밈은 <b>카드의 일부라 팔면 그대로 따라간다</b>(2026-09-23 dev 결정).
     *
     * <p>왜 필요한가: 잘 꾸민 카드는 시세보다 비싸게 팔리는 것이 <b>정상</b>이다. 그래서 R4(가격 이상)는
     * 꾸민 카드를 판단하지 않는다 — 안 그러면 애써 꾸민 사람이 매번 심사에 걸린다.
     *
     * <p>🔴 그런데 같은 이유로 꾸밈은 <b>가격 조작의 알리바이</b>가 된다. 스티커는 하루 5장까지 공짜라
     * 비용 부담도 없다. 공범에게 시세 10배로 팔아 놓고 "잘 꾸며서" 라고 하면 관리자가 반박하기 어렵다.
     * 그래서 가격 대신 <b>행동</b>을 본다 — 꾸민 지 얼마 만에 파는가, 꾸민 사람이 파는 사람인가.
     * 애정을 담아 꾸민 카드를 5분 만에 파는 사람은 드물다.
     *
     * @param present                꾸며진 카드인가
     * @param stickerCount           붙은 스티커 수
     * @param minutesSinceDecoration 마지막으로 꾸민 뒤 이 거래 요청까지 걸린 분. 꾸밈이 없으면 null
     * @param decoratedBySeller      꾸민 사람이 지금 파는 사람인가. 남이 꾸민 걸 사서 바로 되파는 것은 다른 이야기다
     */
    public record Decoration(boolean present, int stickerCount, Long minutesSinceDecoration,
                             boolean decoratedBySeller) {

        public static final Decoration NONE = new Decoration(false, 0, null, false);
    }

    /**
     * 짧은 창의 거래 빈도 (velocity). 카드사 FDS 의 가장 기본 축이고, <b>금액을 전혀 보지 않는다</b>.
     *
     * <p>매집은 지분이 30% 를 넘어야 R7 에 걸리는데, 그때는 이미 쓸어 간 뒤다. 빈도는 그보다 먼저 움직인다.
     * 계정을 털린 뒤의 급처분, 순환 거래의 회전도 여기서 먼저 보인다.
     *
     * @param cardHandoffs24h 이 카드가 최근 24시간에 손바뀜한 횟수. 순환 거래의 회전 속도
     */
    public record Velocity(int buyerTrades10m, int buyerTrades1h,
                           int sellerTrades10m, int sellerTrades1h, int cardHandoffs24h) {

        public static final Velocity EMPTY = new Velocity(0, 0, 0, 0, 0);
    }

    /**
     * 거래 당사자 한 명. 단말은 그 사람이 이 거래에서 낸 요청(등록·입찰·구매)의 것이다.
     *
     * @param phone 전화번호 원문. 규칙 안에서 비교만 하고 <b>신호 evidence 에는 넣지 않는다</b>
     */
    public record Party(Long id, String phone, LocalDateTime createdAt, String ip, String userAgentHash) {

        public boolean hasIp() {
            return ip != null && !ip.isBlank();
        }

        public boolean hasDevice() {
            return hasIp() && userAgentHash != null && !userAgentHash.isBlank();
        }

        public boolean sameIp(Party other) {
            return other != null && hasIp() && other.hasIp() && ip.equals(other.ip);
        }

        public boolean sameUserAgent(Party other) {
            return other != null && userAgentHash != null && other.userAgentHash != null
                    && !userAgentHash.isBlank() && userAgentHash.equals(other.userAgentHash);
        }

        public boolean samePhone(Party other) {
            if (other == null) return false;
            String mine = digitsOf(phone);
            String theirs = digitsOf(other.phone);
            return mine.length() >= 9 && mine.equals(theirs);
        }

        private static String digitsOf(String phone) {
            return phone == null ? "" : phone.replaceAll("\\D", "");
        }
    }

    public boolean isAuction() {
        return source == Source.AUCTION;
    }

    /** 이 거래가 끝나면 구매자가 갖게 되는 같은 도안 카드 수 */
    public int buyerOwnedOfDesignAfter() {
        return buyerOwnedOfDesign + 1;
    }

    public boolean hasRunnerUp() {
        return runnerUp != null && !Objects.equals(runnerUp.id(), buyer.id());
    }
}
