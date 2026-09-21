package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 nft.trade.review.* — 이상거래 심사 설정 (AUCTION_FRAUD_DESIGN.md 10장).
 *
 * <p>규칙 기준값을 코드에 박지 않고 여기 두는 이유는 오탐을 보면서 재배포 없이 조이기 위해서다.
 * {@code enabled=false} 면 스크리너가 빈 결과를 돌려 정산이 예전과 똑같이 흐른다 — 문제가 생겼을 때의 비상 스위치다.
 *
 * @param enabled              심사 켬/끔
 * @param mode                 FLAG 면 걸려도 정산은 그대로 가고 심사 행만 남긴다(데이터 수집). HOLD 면 체인 전송 전에 멈추고 관리자 결정을 기다린다
 * @param autoApproveAfter     HOLD 모드에서 이 시간 안에 관리자가 결정하지 않으면 자동 승인
 * @param pairWindow           R3 반복 거래쌍을 보는 기간
 * @param pairThreshold        R3 기간 안 같은 두 계정의 거래 수가 이 값 이상이면 신호
 * @param priceWindow          R4·R6·R7 시세·거래량을 보는 기간
 * @param priceMultiplier      R4 거래가가 최근 중앙값의 이 배수 이상이면 신호
 * @param priceMinSamples      R4 표본이 이보다 적으면 판단하지 않음
 * @param newAccountAge        R5 가입 후 이 시간 안이면 신규 계정
 * @param depositToBid         R5 첫 충전 후 이 시간 안의 입찰·구매면 신호
 * @param volumeWindow         R6 최근 거래량을 보는 기간
 * @param volumeBaselineWeeks  R6 비교 기준이 되는 그 이전 주 수
 * @param volumeMultiplier     R6 최근 거래 수가 주평균의 이 배수 이상이면 신호
 * @param volumeMinBaseline    R6 기준 기간 거래가 이보다 적으면 판단하지 않음
 * @param hoardShare           R7 이 거래로 도안 발행량의 이 비율 이상을 갖게 되면 신호
 * @param hoardBuyShare        R7 최근 도안 거래의 이 비율 이상을 구매자가 사들였으면 신호
 * @param hoardMinSupply       R7 발행량이 이보다 적은 도안은 판단하지 않음
 * @param takeoverLoginWindow  R8 "아는 단말" 을 보는 로그인 이력 기간
 * @param takeoverFirstLoginToBid R8 새 단말 첫 로그인부터 요청까지 이 시간 안이면 신호 조건
 * @param takeoverSpendMultiplier R8 거래가가 최근 최대 지출의 이 배수 이상이면 신호 조건
 * @param loginEventRetention  로그인 단말 기록 보관 기간. 지나면 스위퍼가 지운다
 * @param maintenanceInterval  시한 자동 승인·기록 정리 스위퍼 주기. @Scheduled 문자열이라 ISO-8601(PT…)
 * @param maintenanceEnabled   스위퍼 켬/끔. 테스트에서 끈다
 */
@ConfigurationProperties(prefix = "nft.trade.review")
public record NftTradeReviewProperties(
        boolean enabled,
        Mode mode,
        Duration autoApproveAfter,
        Duration pairWindow,
        int pairThreshold,
        Duration priceWindow,
        double priceMultiplier,
        int priceMinSamples,
        Duration newAccountAge,
        Duration depositToBid,
        Duration volumeWindow,
        int volumeBaselineWeeks,
        double volumeMultiplier,
        int volumeMinBaseline,
        double hoardShare,
        double hoardBuyShare,
        int hoardMinSupply,
        Duration takeoverLoginWindow,
        Duration takeoverFirstLoginToBid,
        double takeoverSpendMultiplier,
        Duration loginEventRetention,
        Duration maintenanceInterval,
        boolean maintenanceEnabled
) {

    public enum Mode {
        /** 표시만. 정산은 그대로 진행되고 심사 행이 관리자 화면에 쌓인다 */
        FLAG,
        /** 체인 전송 전에 멈추고 관리자 승인·거절을 기다린다 */
        HOLD
    }

    public boolean holds() {
        return mode == Mode.HOLD;
    }
}
