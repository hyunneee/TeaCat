package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftAuctionProperties;
import com.teacat.server.nft.repository.NftAuctionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 만료된 경매를 주기적으로 닫는다.
 *
 * 마감의 진실은 {@link NftAuctionCloser#close} 에 있고 이 클래스는 대상만 고른다. 한 건이 실패해도 다음 건을
 * 계속하고, 실패한 건은 다음 주기에 다시 잡힌다(ACTIVE 로 남아 있으므로).
 *
 * 인스턴스가 여러 개여도 close 가 멱등이라 락 라이브러리가 필요 없다.
 * 테스트는 {@code nft.auction.sweep-enabled=false} 로 끈다 — 마감을 직접 불러 검증하기 위해서다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "nft.auction", name = "sweep-enabled", havingValue = "true", matchIfMissing = true)
public class NftAuctionSweeper {

    private final NftAuctionRepository auctionRepository;
    private final NftAuctionCloser closer;
    private final NftAuctionProperties properties;

    @Scheduled(fixedDelayString = "${nft.auction.sweep-interval}")
    public void sweep() {
        for (Long auctionId : auctionRepository.findExpiredActiveIds(properties.sweepBatchSize())) {
            try {
                closer.close(auctionId);
            } catch (RuntimeException e) {
                log.error("경매 마감 실패 auctionId={}", auctionId, e);
            }
        }
    }
}
