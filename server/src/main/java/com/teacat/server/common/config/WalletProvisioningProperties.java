package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 wallet.provisioning.* 설정.
 *
 * @param retryAfter     PENDING 행을 "실패했거나 메시지가 사라진 것" 으로 보고 다시 보내기까지 기다리는 시간.
 *                       정상 처리는 1초 안에 끝나므로 이보다 길게만 두면 정상 건을 두 번 보내지 않는다
 * @param sweepInterval  스위퍼 주기. @Scheduled 문자열로도 쓰이므로 ISO-8601(PT30S) 로 적는다
 * @param sweepBatchSize 한 주기에 다시 보낼 최대 건수
 * @param sweepEnabled   스위퍼 켬/끔. 테스트에서 끈다
 */
@ConfigurationProperties(prefix = "wallet.provisioning")
public record WalletProvisioningProperties(
        Duration retryAfter,
        Duration sweepInterval,
        int sweepBatchSize,
        boolean sweepEnabled
) {
}
