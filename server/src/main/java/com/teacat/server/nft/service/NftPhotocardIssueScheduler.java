package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftPhotocardIssueProperties;
import com.teacat.server.nft.dto.response.NftPhotocardIssueResponse;
import com.teacat.server.nft.repository.NftMarketQueryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 회차 시작이 임박한 공연 회차의 확정 티켓 보유자에게 포토카드를 자동 발급한다.
 *
 * <p>지금까지 발급은 관리자가 {@code POST /admin/performances/{id}/photocards/issue} 를 손으로
 * 눌러야만 일어났다. 이 스케줄러가 <b>매시 정각</b>에 "회차 시작 1시간 전" 인 회차를 찾아
 * 자동으로 발급한다.
 *
 * <p>발급의 진실은 {@link NftPhotocardIssuer#issueForSchedule} 에 있고 이 클래스는 대상만 고른다.
 * 한 회차가 실패해도 다음 회차를 계속하고, 실패한 회차는 아직 못 받은 확정 티켓이 남아 있어
 * 다음 주기에 다시 잡힌다. 카드 행만 만들고 체인 전송이 실패한 경우도, PENDING 카드가 남아
 * {@code mintPendingForSchedule} 로 이어 보내진다.
 *
 * <p>재발급·재전송이 모두 멱등이라({@code photocardKey = nft_photocards.issue_key}) 인스턴스가 여러 개여도
 * 락 라이브러리는 필요 없다 — {@code SchedulingConfig} 주석대로 "인스턴스 하나" 전제이고, 겹쳐도
 * 조회+멱등 요청이라 위험하진 않다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "nft.photocard.issue", name = "scheduler-enabled",
        havingValue = "true", matchIfMissing = true)
public class NftPhotocardIssueScheduler {

    private final NftMarketQueryRepository queryRepository;
    private final NftPhotocardIssuer photocardIssuer;
    private final NftPhotocardIssueProperties properties;

    @Scheduled(cron = "${nft.photocard.issue.scheduler-cron}")
    public void issueDuePhotocards() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime until = now.plus(properties.leadTime());

        for (Long scheduleId : queryRepository.findScheduleIdsDueForIssue(now, until, properties.batchSize())) {
            try {
                NftPhotocardIssueResponse result = photocardIssuer.issueForSchedule(scheduleId);
                if (result.issuedCount() > 0) {
                    log.info("회차 포토카드 자동 발급 scheduleId={} 발급 {}건 미전송 {}건",
                            scheduleId, result.issuedCount(), result.failedCount());
                }
            } catch (RuntimeException e) {
                log.error("회차 포토카드 자동 발급 실패 scheduleId={} — 다음 주기에 다시 시도합니다", scheduleId, e);
            }
        }
    }
}
