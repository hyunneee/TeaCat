package com.teacat.server.wallet.service;

import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxStatus;
import com.teacat.server.wallet.repository.CatTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 캣머니 발행·소각의 확정 확인.
 *
 * <p>체인 쓰기는 보낸 즉시 확정되지 않습니다(SSAFY 체인 블록 10초). 그래서 요청 스레드를 붙잡지
 * 않고 {@code PENDING} 으로 남긴 뒤 여기서 따라갑니다 (blockchain/DESIGN.md 4-2).
 *
 * <p><b>인스턴스가 하나라는 전제입니다.</b> 블록체인 서비스도 논스 직렬화 때문에 단일 인스턴스라
 * 같은 전제입니다. 서버를 여러 대로 늘리면 같은 건을 중복 조회하게 되므로(조회라 위험하진 않지만
 * 낭비입니다) 락이나 ShedLock 이 필요합니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CatTransactionScheduler {

    /** 한 번에 확인할 건수. 밀리면 다음 차례가 이어서 본다 */
    private static final Limit BATCH_SIZE = Limit.of(100);

    private final CatTransactionRepository catTransactionRepository;
    private final CatMoneyService catMoneyService;

    @Scheduled(
            fixedDelayString = "${blockchain.confirm-poll.interval}",
            initialDelayString = "${blockchain.confirm-poll.initial-delay}")
    public void confirmPending() {
        List<CatTransaction> pending =
                catTransactionRepository.findByStatusOrderByIdAsc(CatTxStatus.PENDING, BATCH_SIZE);
        if (pending.isEmpty()) {
            return;
        }

        for (CatTransaction transaction : pending) {
            try {
                catMoneyService.settle(transaction.getId());
            } catch (RuntimeException e) {
                // 한 건이 실패해도 나머지는 봐야 한다. 다음 차례에 다시 잡힌다
                log.warn("캣머니 거래 확정 확인에 실패했습니다. catTransactionId={}", transaction.getId(), e);
            }
        }
    }
}
