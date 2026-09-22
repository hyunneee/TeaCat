package com.teacat.server.reward.service;

import com.teacat.server.reward.entity.DailyReward;
import com.teacat.server.reward.entity.RewardType;
import com.teacat.server.reward.repository.DailyRewardRepository;
import com.teacat.server.reward.repository.MemoryGameSessionRepository;
import com.teacat.server.reward.repository.MemoryGameSessionRepository.MemoryRankRow;
import com.teacat.server.wallet.entity.CatTransaction;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.service.CatMoneyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.time.LocalDate;
import java.util.Optional;

/**
 * 어제 짝 맞추기 1등에게 캣머니를 준다.
 *
 * <p>하루가 끝나야 1등이 정해지므로 <b>다음날</b> 준다. 사용자가 누르는 보상이 아니라서
 * {@code RewardService.claim} 을 쓰지 않고 여기서 직접 넣는다 — 다만 기록은 같은
 * {@code daily_rewards} 표에 남긴다. 그 표의 유니크 인덱스 {@code (user, type, date)} 가
 * <b>두 번 주는 것을 막는 유일한 장치</b>다: 서버를 다시 띄워 스케줄러가 또 돌아도,
 * 사람이 손으로 한 번 더 돌려도 두 번째는 제약에 걸린다.
 *
 * <p>{@code reward_date} 는 <b>기록을 세운 날(어제)</b>을 쓴다. 준 날로 적으면 같은 날짜에
 * 출석·송편과 섞여 "어느 날 1등의 상금인지" 를 알 수 없다.
 *
 * <p>아무도 깨지 않은 날은 그냥 넘어간다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "reward.memory-rank", name = "scheduler-enabled",
        havingValue = "true", matchIfMissing = true)
public class MemoryRankRewardScheduler {

    private final MemoryGameSessionRepository sessionRepository;
    private final DailyRewardRepository dailyRewardRepository;
    private final CatMoneyService catMoneyService;

    @Scheduled(cron = "${reward.memory-rank.scheduler-cron}")
    public void grantYesterdayWinner() {
        LocalDate target = LocalDate.now().minusDays(1);
        Optional<MemoryRankRow> winner = sessionRepository.findWinner(target);
        if (winner.isEmpty()) {
            log.info("짝 맞추기 {} 기록이 없어 상금을 건너뜁니다", target);
            return;
        }

        MemoryRankRow row = winner.get();
        try {
            grant(row, target);
        } catch (RuntimeException e) {
            // 다음 주기에 다시 잡힌다. 두 번 주는 것은 유니크 인덱스가 막는다
            log.error("짝 맞추기 상금 지급 실패 date={} userId={}", target, row.getUserId(), e);
        }
    }

    private void grant(MemoryRankRow row, LocalDate target) {
        Long userId = row.getUserId();
        if (dailyRewardRepository.findByUserIdAndRewardTypeAndRewardDate(
                userId, RewardType.MEMORY_RANK, target).isPresent()) {
            return;
        }

        DailyReward claim;
        try {
            claim = dailyRewardRepository.saveAndFlush(
                    DailyReward.claim(userId, RewardType.MEMORY_RANK, target));
        } catch (DataIntegrityViolationException e) {
            // 같은 순간에 한 번 더 돌았다. 먼저 넣은 쪽이 지급까지 끝낸다
            return;
        }

        CatTransaction transaction;
        try {
            transaction = catMoneyService.mint(
                    userId,
                    BigInteger.valueOf(RewardType.MEMORY_RANK.amount()),
                    CatTxReason.REWARD,
                    "reward:memory_rank:%d:%s".formatted(userId, target));
        } catch (RuntimeException e) {
            /* 발행을 못 보냈는데 "줬음" 으로 남으면 1등이 상금을 영영 못 받는다.
               선점을 물리고 다음 주기에 다시 시도한다 (RewardService.claim 과 같은 방식) */
            dailyRewardRepository.delete(claim);
            throw e;
        }

        claim.linkTransaction(transaction.getId());
        dailyRewardRepository.save(claim);
        log.info("짝 맞추기 {} 1등 상금 지급 userId={} nickname={} elapsedMs={} amount={}",
                target, userId, row.getNickname(), row.getElapsedMs(),
                RewardType.MEMORY_RANK.amount());
    }
}
