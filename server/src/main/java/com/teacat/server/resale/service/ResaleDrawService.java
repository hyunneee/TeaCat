package com.teacat.server.resale.service;

import com.teacat.server.common.config.ResaleProperties;
import com.teacat.server.resale.client.ResaleDrawChainClient;
import com.teacat.server.resale.client.ResaleDrawChainClient.DrawOpenResult;
import com.teacat.server.resale.client.ResaleDrawChainClient.DrawStateResult;
import com.teacat.server.resale.client.ResaleDrawChainClient.Ranking;
import com.teacat.server.resale.entity.SeatDraw;
import com.teacat.server.resale.repository.SeatDrawRepository;
import com.teacat.server.resale.service.SeatDrawWriter.OpenTarget;
import com.teacat.server.resale.service.SeatDrawWriter.Step;
import com.teacat.server.wallet.client.BlockchainApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 취소표 추첨의 순서를 안다 — 체인을 부르고, 결과를 {@link SeatDrawWriter} 에 적게 한다.
 *
 * <p><b>트랜잭션을 열지 않는다.</b> 체인에 다녀오는 동안 DB 커넥션을 쥐고 있으면 안 되기 때문이다.
 *
 * <pre>
 * 취소 ─┬─ 대기자 없음 → 좌석 AVAILABLE (지금과 같다)
 *       └─ 대기자 있음 → seat_draws PENDING (좌석은 SOLD 로 둔다)
 *            open()    POST /internal/draws/open   커밋. 참가자 목록이 inputsHash 로 굳는다
 *            settle()  GET  /internal/draws/{key}  블록체인 서비스가 다음 블록에 자동 리빌
 *                      POST …/assign               난수 → 순위 (순수 함수)
 *            advance() 1순위에게 좌석을 HELD(당첨자, 결제 기한) 로 넘기고 알림
 *            expire()  기한이 지나면 사람은 대기로, 좌석은 되돌려 새 추첨(open) · 대기자 없으면 AVAILABLE
 * </pre>
 *
 * <p>모든 단계가 멱등이라 취소 요청 스레드와 스위퍼가 동시에 밟아도 값이 어긋나지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResaleDrawService {

    private static final String DRAW_ALREADY_EXISTS = "DRAW_ALREADY_EXISTS";
    /** 순위 루프의 안전 한도. 참가자 수보다 넉넉하면 된다 */
    private static final int MAX_STEPS = 5_000;

    private final SeatDrawWriter writer;
    private final ResaleDrawChainClient chainClient;
    private final SeatDrawRepository seatDrawRepository;
    private final ResaleProperties properties;

    /**
     * 커밋을 보낸다. 실패해도 예외를 밖으로 내지 않는다 — 추첨 행은 PENDING 으로 남고 스위퍼가 다시 보낸다.
     * 취소 요청 스레드에서 부르므로 여기서 던지면 사용자에게 "취소 실패" 로 보인다.
     */
    public void open(Long drawId) {
        Optional<OpenTarget> claimed = writer.claimOpen(drawId);
        if (claimed.isEmpty()) {
            return;
        }
        OpenTarget target = claimed.get();
        try {
            DrawOpenResult result = chainClient.openDraw(
                    target.drawKey(), target.performanceId(), target.participantIds());
            writer.applyOpened(drawId, result.txHash(), result.inputsHash());
        } catch (BlockchainApiException e) {
            if (DRAW_ALREADY_EXISTS.equals(e.getRemoteCode())) {
                // 앞선 시도가 응답만 못 받고 체인에는 실렸다. 상태 조회로 이어간다
                writer.applyOpened(drawId, null, null);
                return;
            }
            log.warn("취소표 추첨 커밋 실패, 스위퍼가 다시 시도합니다 drawId={} code={} message={}",
                    drawId, e.getRemoteCode(), e.getRemoteMessage());
        } catch (RuntimeException e) {
            log.warn("취소표 추첨 커밋 실패, 스위퍼가 다시 시도합니다 drawId={}", drawId, e);
        }
    }

    /** OPEN 인 추첨의 난수가 확정됐는지 본다. 확정됐으면 순위를 받아 첫 당첨자에게 넘긴다 */
    public void settle(Long drawId) {
        SeatDraw draw = seatDrawRepository.findById(drawId).orElse(null);
        if (draw == null || !draw.isOpen()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        DrawStateResult state = chainClient.state(draw.getDrawKey());

        if (state.isRevealed()) {
            Ranking ranking = chainClient.rank(draw.getDrawKey(), draw.getPerformanceId(),
                    draw.participantIdList());
            writer.applyRevealed(drawId, ranking.randomness(), ranking.orderedParticipantIds());
            advance(drawId);
            return;
        }
        if (state.isCanceled()) {
            reopen(drawId, "체인에서 취소된 추첨");
            return;
        }
        if (!state.exists()) {
            // 커밋 트랜잭션이 드롭됐다. 충분히 기다린 뒤에만 되돌린다 — 방금 보낸 것은 아직 안 실린 게 정상이다
            if (draw.getUpdatedAt().plus(properties.openRetryAfter()).isBefore(now)) {
                writer.applyResetToPending(drawId);
            }
            return;
        }
        // OPEN 인데 블록해시 창을 넘길 만큼 지났다. 그 키는 죽었다 — 새 키로 다시 연다
        if (draw.getUpdatedAt().plus(properties.revealTimeout()).isBefore(now)) {
            reopen(drawId, "리빌 시한 초과 (블록해시 창)");
        }
    }

    /**
     * 확정된 순위의 1순위에게 좌석을 넘긴다. 구매권을 쥔 사람이 있으면 아무것도 하지 않는다.
     *
     * <p>1순위가 그 사이 대기를 접었거나 다른 좌석에 당첨됐으면, 또 좌석 UPDATE 가 유니크 제약에
     * 걸리면(같은 회차의 다른 좌석을 선점 중) 그 순위를 건너뛰고 다음 사람으로 간다 — 자리를 비워
     * 두는 것보다 낫다. 기한 만료·포기는 여기가 아니라 재추첨으로 처리한다.
     */
    public void advance(Long drawId) {
        for (int i = 0; i < MAX_STEPS; i++) {
            Step step;
            try {
                step = writer.step(drawId);
            } catch (DataIntegrityViolationException e) {
                writer.skipCurrentRank(drawId);
                continue;
            }
            if (step != Step.SKIPPED) {
                return;
            }
        }
        log.error("취소표 추첨 순위 루프가 한도에 닿았습니다 drawId={}", drawId);
    }

    /** 기한이 지난 당첨을 접는다. 사람은 대기로 돌아가고 좌석은 남은 대기자끼리 <b>다시 추첨</b>한다 */
    public void expire(Long entryId, LocalDateTime now) {
        writer.expireEntry(entryId, now).ifPresent(this::open);
    }

    /**
     * 사용자가 대기를 접는다. 당첨을 포기한 것이면 좌석을 되돌려 새 추첨을 연다.
     *
     * @param rejoin 포기하면서 다시 대기를 고른 경우 (다음 표부터 참여)
     */
    public void cancelOrForfeit(Long userId, Long entryId, boolean rejoin) {
        writer.cancelOrForfeit(userId, entryId, rejoin).ifPresent(this::open);
    }

    private void reopen(Long drawId, String reason) {
        writer.failAndReopen(drawId, reason).ifPresent(this::open);
    }
}
