package com.teacat.server.wallet.service;

import com.teacat.server.common.config.WalletProvisioningProperties;
import com.teacat.server.wallet.entity.WalletProvisionStatus;
import com.teacat.server.wallet.messaging.WalletProvisionPublisher;
import com.teacat.server.wallet.repository.WalletProvisionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 오래 PENDING 인 지갑 발급 요청을 다시 큐에 보낸다.
 *
 * <p>이 클래스가 <b>재시도의 유일한 경로</b>다. 소비자가 실패한 건, 발행이 실패한 건,
 * 브로커가 죽어 있던 동안 생긴 건, 메시지가 사라진 건을 구분하지 않는다 — 전부 "PENDING 이고
 * 마지막으로 건드린 뒤 retry-after 가 지난 행" 으로 보인다.
 *
 * <p>정상 건은 1초 안에 DONE 이 되므로 retry-after(기본 30초)보다 오래 PENDING 인 것은 무언가 잘못된 것이다.
 * 같은 건을 두 인스턴스가 함께 보내도 소비자가 행을 잠그고 DONE 을 확인하므로 안전하다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "wallet.provisioning", name = "sweep-enabled", havingValue = "true", matchIfMissing = true)
public class WalletProvisionSweeper {

    private final WalletProvisionRepository walletProvisionRepository;
    private final WalletProvisionPublisher publisher;
    private final WalletProvisioningProperties properties;

    @Scheduled(
            fixedDelayString = "${wallet.provisioning.sweep-interval}",
            initialDelayString = "${wallet.provisioning.sweep-interval}")
    public void sweep() {
        LocalDateTime before = LocalDateTime.now().minus(properties.retryAfter());
        List<Long> stale = walletProvisionRepository.findIdsByStatusAndUpdatedAtBefore(
                WalletProvisionStatus.PENDING, before, Limit.of(properties.sweepBatchSize()));
        if (stale.isEmpty()) {
            return;
        }

        int sent = 0;
        for (Long provisionId : stale) {
            if (publisher.publish(provisionId)) {
                sent++;
            }
        }
        log.info("밀린 지갑 발급 요청 {}건 중 {}건을 다시 보냈습니다", stale.size(), sent);
    }
}
