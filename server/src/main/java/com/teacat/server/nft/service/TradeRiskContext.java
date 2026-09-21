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
 * @param priceSamples               그 표본 수
 * @param recentVolume               같은 도안 최근 기간(volume-window) 완료 거래 수
 * @param recentVolumeWithParties    그중 판매자 또는 구매자가 낀 것
 * @param baselineVolume             그 이전 기준 기간(volume-baseline-weeks) 완료 거래 수
 * @param designIssuedSupply         도안 발행량
 * @param buyerOwnedOfDesign         구매자가 지금 가진 같은 도안 카드 수 (이 거래 전)
 * @param designTradesInWindow       같은 도안 최근 기간(price-window) 완료 거래 수
 * @param buyerBuysOfDesignInWindow  그중 구매자가 산 것
 * @param buyerFirstDepositAt        구매자의 첫 원화 충전(DEPOSIT) 시각. 없으면 null. ADMIN_GRANT 는 세지 않는다
 * @param buyerPriorDeviceLogins     요청 전 기간 안, 요청 단말과 <b>다른</b> 단말에서의 로그인 수
 * @param buyerDeviceFirstLoginAt    요청 단말에서의 첫 로그인 시각. 그 단말 로그인 기록이 없으면 null
 * @param buyerMaxSpendInWindow      구매자의 최근 기간 최대 구매가. 구매 이력 없으면 null
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
        int priceSamples,
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
        LocalDateTime now
) {

    public enum Source { AUCTION, LISTING }

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
