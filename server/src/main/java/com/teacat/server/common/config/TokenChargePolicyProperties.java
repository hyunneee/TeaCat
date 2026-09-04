package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yaml 의 payment.token-charge.* 설정.
 *
 * 충전 한도는 운영 판단으로 바뀌는 값이라 코드에 박지 않는다.
 * 상한이 필요한 이유는 두 가지다 — 실수로 0 을 더 붙이는 사고를 막고,
 * 탈취된 계정으로 큰 금액이 한 번에 나가는 것을 늦춘다.
 */
@ConfigurationProperties(prefix = "payment.token-charge")
public record TokenChargePolicyProperties(int minAmount, int maxAmount) {
}
