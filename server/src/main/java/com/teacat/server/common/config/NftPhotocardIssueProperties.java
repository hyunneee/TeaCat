package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 nft.photocard.issue.* 설정.
 *
 * <p>회차 시작이 임박한 공연 회차의 확정 티켓 보유자에게 포토카드를 자동 발급하는 스케줄러가 읽는다.
 * (blockchain/PHOTOCARD_PLAN.md 6-4 · {@code nft.service.NftPhotocardIssueScheduler})
 *
 * @param schedulerCron    발급 스케줄러 주기. {@code @Scheduled(cron)} 이 그대로 읽으므로 6필드 cron 표기다 (기본 매시 정각)
 * @param leadTime         회차 시작이 지금부터 이 시간 이내면 발급 대상으로 본다
 * @param batchSize        한 주기에 처리할 최대 회차 수
 * @param schedulerEnabled 스케줄러 켬/끔. 테스트에서 끈다
 */
@ConfigurationProperties(prefix = "nft.photocard.issue")
public record NftPhotocardIssueProperties(
        String schedulerCron,
        Duration leadTime,
        int batchSize,
        boolean schedulerEnabled
) {
}
