package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 nft.auction.* 설정.
 *
 * @param minDuration    판매자가 고를 수 있는 최소 진행 시간
 * @param maxDuration    최대 진행 시간
 * @param sweepInterval  만료 경매를 훑는 주기. @Scheduled 문자열로도 쓰이므로 ISO-8601(PT10S) 로 적는다
 * @param sweepBatchSize 한 주기에 닫을 최대 건수
 * @param sweepEnabled   스위퍼 켬/끔. 테스트에서 끈다
 */
@ConfigurationProperties(prefix = "nft.auction")
public record NftAuctionProperties(
        Duration minDuration,
        Duration maxDuration,
        Duration sweepInterval,
        int sweepBatchSize,
        boolean sweepEnabled
) {

    public boolean isDurationAllowed(Duration duration) {
        return !duration.minus(minDuration).isNegative() && !maxDuration.minus(duration).isNegative();
    }
}
