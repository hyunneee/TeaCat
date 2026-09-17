package com.teacat.server.nft.service;

import com.teacat.server.nft.repository.NftPhotocardTradeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class NftTradeSettlementScheduler {
    private static final int BATCH_SIZE = 100;
    private final NftPhotocardTradeRepository tradeRepository;
    private final NftTradeSettlementProcessor processor;

    @Scheduled(fixedDelayString = "${blockchain.confirm-poll.interval}",
            initialDelayString = "${blockchain.confirm-poll.initial-delay}")
    public void settle() {
        for (Long tradeId : tradeRepository.findSettlementWork(BATCH_SIZE)) {
            try {
                processor.process(tradeId);
            } catch (RuntimeException e) {
                log.warn("NFT 거래 정산 스케줄러 오류 tradeId={}", tradeId, e);
            }
        }
    }
}
