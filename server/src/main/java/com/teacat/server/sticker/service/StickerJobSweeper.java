package com.teacat.server.sticker.service;

import com.teacat.server.common.config.StickerProperties;
import com.teacat.server.sticker.repository.StickerJobRepository;
import com.teacat.server.sticker.entity.StickerJob;
import com.teacat.server.sticker.entity.StickerJobStatus;
import com.teacat.server.wallet.entity.CatTxReason;
import com.teacat.server.wallet.service.CatMoneyService;

import java.math.BigInteger;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * 방치된 작업을 정리한다. 이게 없으면 사용자 화면이 영원히 "그리고 있어요" 에 멈춘다.
 *
 * <table>
 *   <caption>정리 대상</caption>
 *   <tr><th>대상</th><th>조건</th><th>결과</th></tr>
 *   <tr><td>멈춘 워커</td><td>RUNNING · 집어간 지 claim-timeout</td><td>PENDING 복귀, retry_count+1</td></tr>
 *   <tr><td>재시도 소진</td><td>위와 같고 retry_count 가 상한</td><td>FAILED / RETRY_EXHAUSTED</td></tr>
 *   <tr><td>워커 없음</td><td>PENDING · 만든 지 pending-timeout</td><td>FAILED / NO_WORKER</td></tr>
 * </table>
 *
 * <p>🔴 세 번째가 없으면 <b>워커를 아예 안 띄운 경우를 못 잡는다.</b> 그때 작업은 RUNNING 이
 * 되질 않아 위 두 판에 걸리지 않는다. 발표 당일 노트북을 안 띄웠거나 GPU 서버가 죽은 상황이
 * 정확히 여기다 — 드문 경우가 아니라 가장 자주 만나는 경우다.
 *
 * <p>셋 다 FAILED 라 <b>오늘 몫이 돌아온다</b>({@code status <> 'FAILED'} 로 센다).
 *
 * <p>세 문장 다 집합 단위 UPDATE 라 방치된 작업이 수백 건이어도 왕복이 세 번이다. 인스턴스를
 * 여럿으로 늘려도 {@code WHERE status = …} 가 행 잠금으로 직렬화돼 중복 처리가 되지 않는다.
 *
 * <p>테스트는 {@code sticker.sweep-enabled=false} 로 끄고 {@link #sweep()} 을 직접 부른다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "sticker", name = "sweep-enabled", havingValue = "true", matchIfMissing = true)
public class StickerJobSweeper {

    private final StickerJobRepository jobRepository;
    private final StickerProperties properties;
    private final CatMoneyService catMoneyService;

    @Scheduled(fixedDelayString = "${sticker.sweep-interval}")
    @Transactional
    public void sweep() {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime claimDeadline = now.minus(properties.claimTimeout());
        OffsetDateTime pendingDeadline = now.minus(properties.pendingTimeout());

        /* 🔴 순서가 규칙이다. 되돌림을 먼저 돌리면 retry_count 가 이번 판에 상한에 닿은 작업이
           바로 아래 소진 검사에 또 걸려, 한 번도 재시도하지 못하고 FAILED 가 된다.
           재시도가 통째로 죽어도 겉으로는 아무 일 없어 보이므로 눈으로는 못 찾는다. */
        int exhausted = jobRepository.failExhausted(claimDeadline, properties.maxRetry());
        int requeued = jobRepository.requeueStalled(claimDeadline, properties.maxRetry());
        int abandoned = jobRepository.failAbandoned(pendingDeadline);

        int refunded = refundFailedPaidJobs();

        // 한 건이라도 있을 때만 남긴다. 매분 "0건" 을 찍으면 진짜 신호가 묻힌다
        if (exhausted + requeued + abandoned + refunded > 0) {
            log.info("스티커 작업 정리: 복귀 {}, 재시도 소진 {}, 워커 없음 {}, 환불 {}",
                    requeued, exhausted, abandoned, refunded);
        }
    }

    /**
     * 돈을 받았는데 실패한 건을 돌려준다.
     *
     * <p>🔴 <b>실패 경로마다 심지 않고 여기 한 곳에서 한다.</b> 재시도 소진·워커 없음·워커 신고
     * 셋 중 하나를 빠뜨리면 <b>돈이 안 돌아간다</b> — 사용자는 알 수 없고 우리도 모른다.
     * 상태로 찾으면 어느 길로 실패했든 걸린다.
     *
     * <p>⚠️ 한 건이 터져도 나머지는 돌려준다. 체인 호출이라 한 건의 실패가 전부를 막으면
     * 안 된다. 실패는 {@code ERROR} 로 남겨 Sentry 로 올린다 — 사람이 봐야 하는 종류다.
     */
    private int refundFailedPaidJobs() {
        List<StickerJob> targets = jobRepository
                .findTop50ByStatusAndPaidCatGreaterThanAndRefundedAtIsNull(StickerJobStatus.FAILED, 0);
        int done = 0;
        for (StickerJob job : targets) {
            try {
                catMoneyService.mint(job.getUser().getId(), BigInteger.valueOf(job.getPaidCat()),
                        CatTxReason.REFUND, "sticker:refund:" + job.getId());
                job.markRefunded();
                done++;
            } catch (RuntimeException e) {
                log.error("스티커 실패 건 환불에 실패했습니다. jobId={}, paidCat={}",
                        job.getId(), job.getPaidCat(), e);
            }
        }
        return done;
    }
}
