package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yaml 의 analytics.* 설정.
 *
 * <p>{@code internalApiKey} 는 젠킨스가 배포 기록을 보낼 때 쓰는 키다.
 * 저장소에 두지 않고 {@code .env} / 배포 서버의 {@code .env.prod} 에서 읽는다.
 *
 * <p>🔴 비워 두면 {@code /internal/deployments} 가 통째로 잠긴다(모든 요청 401).
 * 키가 없는데 열어두면 아무나 배포 마커를 심을 수 있다 — 안 되는 편이 낫다.
 */
@ConfigurationProperties(prefix = "analytics")
public record AnalyticsProperties(String internalApiKey) {
}
