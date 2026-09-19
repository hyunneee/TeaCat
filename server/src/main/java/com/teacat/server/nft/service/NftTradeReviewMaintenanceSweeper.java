package com.teacat.server.nft.service;

import com.teacat.server.auth.service.LoginEventRecorder;
import com.teacat.server.common.config.NftTradeReviewProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 이상거래 심사의 유지 작업 두 가지를 주기적으로 한다.
 * <ol>
 *   <li>시한({@code auto-approve-after})이 지난 심사를 자동 승인한다 — 관리자가 안 봐서 사용자 돈이 영영 묶이지 않게.</li>
 *   <li>보관 기간({@code login-event-retention})이 지난 로그인 단말 기록을 지운다 — 심사 외 용도가 없는 개인정보다.</li>
 * </ol>
 * 다른 스위퍼와 같이 인스턴스 하나 전제다. 테스트는 {@code nft.trade.review.maintenance-enabled=false} 로 끈다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "nft.trade.review", name = "maintenance-enabled", havingValue = "true",
        matchIfMissing = true)
public class NftTradeReviewMaintenanceSweeper {

    private static final int AUTO_APPROVE_BATCH = 50;

    private final NftTradeReviewService reviewService;
    private final LoginEventRecorder loginEventRecorder;
    private final NftTradeReviewProperties properties;

    @Scheduled(fixedDelayString = "${nft.trade.review.maintenance-interval}", initialDelayString = "PT1M")
    public void sweep() {
        try {
            int approved = reviewService.autoApproveExpired(AUTO_APPROVE_BATCH);
            if (approved > 0) {
                log.info("NFT 거래 심사 시한 경과 자동 승인 {}건", approved);
            }
        } catch (RuntimeException e) {
            log.error("NFT 거래 심사 자동 승인 스위퍼 오류", e);
        }
        try {
            int deleted = loginEventRecorder.deleteOlderThan(LocalDateTime.now().minus(properties.loginEventRetention()));
            if (deleted > 0) {
                log.info("로그인 단말 기록 정리 {}건", deleted);
            }
        } catch (RuntimeException e) {
            log.error("로그인 단말 기록 정리 오류", e);
        }
    }
}
