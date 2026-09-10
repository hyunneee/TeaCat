package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftPhotocardDrawProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 체인에 못 보낸 뽑기 카드를 주기적으로 다시 보낸다.
 *
 * <p>뽑기 응답 직후 한 번 보내고, 그게 실패한 카드만 여기서 잡힌다. 방금 뽑아 아직 전송 중인 카드가
 * 섞여도 컨트랙트가 같은 {@code photocardKey} 를 건너뛰므로 두 장 나가지 않는다.
 * 테스트는 {@code nft.photocard.draw.sweep-enabled=false} 로 끈다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "nft.photocard.draw", name = "sweep-enabled",
        havingValue = "true", matchIfMissing = true)
public class NftPhotocardDrawSweeper {

    private final NftPhotocardMinter minter;
    private final NftPhotocardDrawProperties properties;

    @Scheduled(fixedDelayString = "${nft.photocard.draw.sweep-interval}")
    public void sweep() {
        try {
            int sent = minter.mintPendingDraws(properties.sweepBatchSize());
            if (sent > 0) {
                log.info("뽑기 포토카드 재전송 {}건", sent);
            }
        } catch (RuntimeException e) {
            log.error("뽑기 포토카드 재전송 실패 — 다음 주기에 다시 시도합니다", e);
        }
    }
}
