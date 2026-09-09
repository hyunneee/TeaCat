package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 nft.design.* 설정.
 *
 * @param confirmInterval  등록 트랜잭션의 확정을 훑는 주기. @Scheduled 문자열로도 쓰이므로 ISO-8601(PT10S) 로 적는다
 * @param confirmBatchSize 한 주기에 확인할 최대 건수
 * @param confirmEnabled   확정 감시 켬/끔. 테스트에서 끈다
 */
@ConfigurationProperties(prefix = "nft.design")
public record NftDesignProperties(
        Duration confirmInterval,
        int confirmBatchSize,
        boolean confirmEnabled
) {
}
