package com.teacat.server.resale.service;

import com.teacat.server.common.config.BookingPolicyProperties;
import com.teacat.server.common.config.ResaleProperties;
import com.teacat.server.resale.entity.SeatDraw;
import com.teacat.server.resale.entity.SeatDrawStatus;
import com.teacat.server.resale.repository.ResaleEntryRepository;
import com.teacat.server.resale.repository.SeatDrawRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.function.Consumer;

/**
 * 취소표 추첨을 주기적으로 밀어 준다.
 *
 * <p>취소 요청 스레드가 커밋까지는 곧바로 보내지만, 난수는 <b>다음 블록(약 10초)</b>이 지나야
 * 확정된다. 그걸 기다려 순위를 받고 당첨자에게 좌석을 넘기는 것이 이 클래스다. 그 밖에
 * 커밋을 못 보낸 추첨의 재시도, 기한이 지난 당첨의 다음 순위 이양, 취소 마감이 지난 대기의
 * 정리도 여기서 한다.
 *
 * <p>진실은 {@link ResaleDrawService} 에 있고 이 클래스는 대상만 고른다. 한 건이 실패해도 다음 건을
 * 계속하고, 실패한 건은 상태가 그대로라 다음 주기에 다시 잡힌다. 전부 멱등이다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "booking.resale", name = "sweep-enabled", havingValue = "true", matchIfMissing = true)
public class ResaleDrawSweeper {

    private final SeatDrawRepository seatDrawRepository;
    private final ResaleEntryRepository resaleEntryRepository;
    private final ResaleDrawService drawService;
    private final SeatDrawWriter writer;
    private final ResaleProperties properties;
    private final BookingPolicyProperties bookingPolicy;

    @Scheduled(fixedDelayString = "${booking.resale.sweep-interval}")
    public void sweep() {
        LocalDateTime now = LocalDateTime.now();
        Limit limit = Limit.of(properties.batchSize());

        // ① 커밋을 못 보낸 추첨. 취소 스레드가 방금 만든 것은 그쪽이 보내므로 조금 기다린 것만
        LocalDateTime retryBefore = now.minus(properties.openRetryAfter());
        forEach(seatDrawRepository.findByStatusOrderByIdAsc(SeatDrawStatus.PENDING, limit),
                draw -> {
                    if (draw.getUpdatedAt().isBefore(retryBefore)) {
                        drawService.open(draw.getId());
                    }
                }, "커밋 재시도");

        // ② 커밋은 갔고 난수를 기다리는 추첨
        forEach(seatDrawRepository.findByStatusOrderByIdAsc(SeatDrawStatus.OPEN, limit),
                draw -> drawService.settle(draw.getId()), "난수 확인");

        // ③ 난수는 있는데 구매권을 쥔 사람이 없는 추첨 — 넘기다 멈춘 것을 이어간다.
        //    구매권을 쥔 당첨자가 있는 추첨은 여기 잡히지 않는다 (12시간 동안 배치를 차지하지 않게)
        forEach(seatDrawRepository.findRevealedNeedingAdvance(limit),
                draw -> drawService.advance(draw.getId()), "순위 진행");

        // ④ 기한이 지난 당첨 → 다음 순위
        for (Long entryId : resaleEntryRepository.findExpiredWonIds(now, limit)) {
            try {
                drawService.expire(entryId, now);
            } catch (RuntimeException e) {
                log.warn("취소표 당첨 만료 처리 실패 entryId={}", entryId, e);
            }
        }

        // ⑤ 취소 마감이 지난 회차 — 더 이상 취소표가 나올 수 없으니 대기를 접는다
        try {
            int lost = writer.markLostPastDeadline(now.plus(bookingPolicy.cancelDeadlineLead()), now);
            if (lost > 0) {
                log.info("취소 마감이 지난 대기 {}건을 LOST 로 접었습니다", lost);
            }
        } catch (RuntimeException e) {
            log.warn("취소표 대기 LOST 정리 실패", e);
        }
    }

    private void forEach(Iterable<SeatDraw> draws, Consumer<SeatDraw> action, String what) {
        for (SeatDraw draw : draws) {
            try {
                action.accept(draw);
            } catch (RuntimeException e) {
                // 블록체인 서비스가 잠깐 죽은 것과 추첨 실패는 다르다. 확정하지 않고 다음 주기에 다시 본다
                log.warn("취소표 추첨 {} 실패 drawId={}", what, draw.getId(), e);
            }
        }
    }
}
