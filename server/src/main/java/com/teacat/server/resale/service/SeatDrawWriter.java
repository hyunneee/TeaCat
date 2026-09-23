package com.teacat.server.resale.service;

import com.teacat.server.booking.entity.PerformanceSeat;
import com.teacat.server.booking.entity.PerformanceSeatId;
import com.teacat.server.booking.entity.SeatBookingStatus;
import com.teacat.server.booking.repository.PerformanceSeatRepository;
import com.teacat.server.common.config.ResaleProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.notification.entity.NotificationType;
import com.teacat.server.notification.service.NotificationService;
import com.teacat.server.performance.entity.PerformanceDetail;
import com.teacat.server.performance.repository.PerformanceDetailRepository;
import com.teacat.server.resale.entity.ResaleEntry;
import com.teacat.server.resale.entity.ResaleEntryStatus;
import com.teacat.server.resale.entity.SeatDraw;
import com.teacat.server.resale.exception.ResaleErrorCode;
import com.teacat.server.resale.repository.ResaleEntryRepository;
import com.teacat.server.resale.repository.SeatDrawRepository;
import com.teacat.server.stadium.entity.Area;
import com.teacat.server.stadium.repository.AreaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * 취소표 추첨 상태를 쓰는 <b>트랜잭션 단위</b>들.
 *
 * <p>여기에는 <b>외부 호출이 없다.</b> 체인을 부르지 않는다 — 체인에 다녀오는 동안(블록 10초) DB
 * 트랜잭션이 열려 있으면 커넥션 풀이 마른다. 순서를 아는 쪽은 {@link ResaleDrawService} 이고,
 * 여기는 그 결과를 받아 적기만 한다. ({@code NftDesignChainWriter} 와 같은 구조)
 *
 * <p>모든 메서드가 추첨 행을 잠그고 읽는다. 상태를 바꾸는 경로가 넷이기 때문이다 —
 * 취소 요청 · 스위퍼 · 당첨자의 포기 · 결제 확정.
 *
 * <h3>한 표에 한 추첨, 놓치면 다시 추첨</h3>
 *
 * 취소표 하나가 생기면 그 순간 그 구역의 대기자 전원을 참가자로 묶어 추첨 하나를 연다. 난수가 확정되면
 * 1순위가 좌석을 받는다(그 사이 대기를 접었거나 다른 좌석에 당첨된 사람은 건너뛴다). 당첨자가 기한을
 * 넘기거나 포기하면 순위를 이어가지 않고 <b>좌석을 되돌려 새 추첨을 연다</b> — 그 사이 대기가 늘었을 수
 * 있고, "표가 나오면 그때의 대기자 전원을 대상으로 뽑는다" 는 규칙이 두 번째 표에도 같아야 한다.
 * 놓친 사람은 대기로 돌아가 <b>다음 표부터</b> 다시 참가자가 된다(방금 놓친 좌석의 재추첨에는 들어가지 않는다).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SeatDrawWriter {

    private static final DateTimeFormatter DEADLINE_FORMAT = DateTimeFormatter.ofPattern("MM-dd HH:mm");
    private static final String REF_TYPE_ENTRY = "RESALE_ENTRY";
    private static final String MY_RESALE_PATH = "/my/resale";

    private final SeatDrawRepository seatDrawRepository;
    private final ResaleEntryRepository resaleEntryRepository;
    private final PerformanceSeatRepository performanceSeatRepository;
    private final PerformanceDetailRepository performanceDetailRepository;
    private final AreaRepository areaRepository;
    private final NotificationService notificationService;
    private final ResaleProperties resaleProperties;

    /** 커밋 요청에 실어 보낼 값. 이걸 꺼낸 뒤에는 트랜잭션 없이 체인을 부른다 */
    public record OpenTarget(Long drawId, String drawKey, Long performanceId, List<Long> participantIds) {
    }

    /** {@link #step} 한 번의 결과 */
    public enum Step {
        /** 당첨자에게 좌석을 넘겼다 */
        GRANTED,
        /** 그 순위는 이미 대기를 접었거나 다른 좌석에 당첨됐다. 다음 순위를 보라 */
        SKIPPED,
        /** 참가자가 전부 빠져 좌석을 일반 판매로 풀었다 */
        EXHAUSTED,
        /** 구매권을 쥔 사람이 아직 있거나, 난수가 아직 없다. 할 일이 없다 */
        IDLE,
        /** 좌석이 추첨의 손을 떠났다. 더 진행하지 않는다 */
        STOPPED
    }

    /**
     * 취소된 좌석을 추첨 대상으로 잡는다. <b>예매 취소 트랜잭션 안에서</b> 부른다 — 좌석을 풀지
     * 않는 결정과 추첨 행이 같이 커밋돼야 한다.
     *
     * <h4>참가자는 여기서, 이 순간에 굳는다</h4>
     *
     * 난수가 확정되기까지 약 15초가 걸리지만(다음 블록 + 스위퍼) 그 사이에 들어온 대기 신청은
     * <b>이 추첨에 끼지 못한다.</b> 참가자 목록을 취소 트랜잭션 안에서 읽어 {@code participantIds} 에
     * 박아 두고, 체인 커밋도 그 목록의 {@code inputsHash} 로 나가기 때문이다. 늦게 온 사람은
     * 다음 취소표의 추첨 풀에 들어간다.
     *
     * <p>이건 공정성 문제이기도 하다 — 목록이 커밋 뒤에도 바뀔 수 있으면, 결과를 보고 참가자를
     * 끼워 넣는 것이 가능해진다. 체인에 박힌 해시가 그걸 막는다.
     *
     * @return 대기자가 한 명도 없으면 empty. 그때는 부르는 쪽이 좌석을 그냥 푼다
     */
    @Transactional
    public Optional<Long> claimSeatForDraw(Long performanceId, Long performanceDetailId, Long areaId,
                                           Long seatId, Long ticketOrderId) {
        List<Long> participants = waitingParticipantIds(performanceDetailId, areaId, null);
        if (participants.isEmpty()) {
            return Optional.empty();
        }

        /* 🔴 이 좌석에 이미 도는 추첨이 있으면 새로 만들지 않는다. 좌석마다 하나뿐이고
           (uq_seat_draws_active_seat) 둘째를 넣으려 하면 취소가 통째로 실패한다.
           정상 흐름에서는 생기지 않지만, 그 전제가 깨졌을 때 사용자에게 500 을 보여주는 것보다
           돌고 있는 추첨을 그대로 쓰는 편이 낫다 */
        Optional<SeatDraw> running = seatDrawRepository.findActiveBySeat(performanceDetailId, seatId);
        if (running.isPresent()) {
            log.warn("이미 도는 추첨이 있어 그대로 씁니다 drawId={} seatId={}", running.get().getId(), seatId);
            return Optional.of(running.get().getId());
        }

        /* 🔴 회차는 **이어서** 센다. 늘 1 로 시작하면 한 번 추첨이 돌았던 좌석의 두 번째 취소가
           draw_key UNIQUE 에 걸려 500 이 된다 — 당첨자가 산 좌석을 그 사람이 다시 취소하는,
           아주 평범한 흐름이다 (2026-09-23 재현). 끝난 추첨도 키는 영구히 남는다 */
        int drawNo = seatDrawRepository.maxDrawNo(performanceDetailId, seatId) + 1;

        SeatDraw draw = seatDrawRepository.save(SeatDraw.open(
                performanceId, performanceDetailId, areaId, seatId, drawNo, participants, ticketOrderId));
        log.info("취소표 추첨 생성 drawId={} key={} participants={}", draw.getId(), draw.getDrawKey(),
                participants.size());
        return Optional.of(draw.getId());
    }

    /** 보낼 수 있는 상태(PENDING)인지 보고 요청 값을 꺼낸다 */
    @Transactional
    public Optional<OpenTarget> claimOpen(Long drawId) {
        SeatDraw draw = lockDraw(drawId);
        if (!draw.isPending()) {
            return Optional.empty();
        }
        return Optional.of(new OpenTarget(draw.getId(), draw.getDrawKey(), draw.getPerformanceId(),
                draw.participantIdList()));
    }

    /** 커밋을 보냈다(또는 이미 열려 있었다) */
    @Transactional
    public void applyOpened(Long drawId, String txHash, String inputsHash) {
        SeatDraw draw = lockDraw(drawId);
        if (!draw.isPending()) {
            return;
        }
        draw.markOpened(txHash, inputsHash);
        log.info("취소표 추첨 커밋 drawId={} tx={}", drawId, txHash);
    }

    /** 커밋을 보내지 못했다. 사유만 적고 PENDING 으로 둔다 — 스위퍼가 간격을 두고 다시 보낸다 */
    @Transactional
    public void applyOpenFailed(Long drawId, String reason) {
        SeatDraw draw = lockDraw(drawId);
        if (!draw.isPending()) {
            return;
        }
        draw.recordOpenFailure(reason);
    }

    /** 커밋 트랜잭션이 체인에 실리지 않았다. 다시 보내게 되돌린다 */
    @Transactional
    public void applyResetToPending(Long drawId) {
        SeatDraw draw = lockDraw(drawId);
        if (!draw.isOpen()) {
            return;
        }
        draw.resetToPending();
        log.warn("취소표 추첨 커밋이 체인에 없습니다. 다시 보냅니다 drawId={}", drawId);
    }

    /** 난수가 확정됐고 순위가 계산됐다 */
    @Transactional
    public void applyRevealed(Long drawId, String randomness, List<Long> ranking) {
        SeatDraw draw = lockDraw(drawId);
        if (!draw.isOpen()) {
            return;
        }
        draw.markRevealed(randomness, ranking);
        log.info("취소표 추첨 확정 drawId={} randomness={} ranking={}", drawId, randomness, ranking);
    }

    /**
     * 순위 <b>하나</b>를 처리한다 — 1순위가 아직 대기 중이면 그 사람이 당첨자다.
     *
     * <p>순위를 뒤로 넘기는 경우는 하나뿐이다: 커밋과 리빌 사이(약 10초)에 그 사람이 대기를 접었거나
     * 다른 좌석에 당첨된 경우. 기한 만료·포기는 순위 이양이 아니라 재추첨이다 ({@link #expireEntry}).
     *
     * <p>한 트랜잭션에 한 순위인 이유: 당첨자에게 좌석을 넘기는 UPDATE 가 {@code uq_performance_seats_held_by}
     * 에 걸리면 Postgres 는 그 트랜잭션을 통째로 접는다. 여러 순위를 한 번에 처리하다 걸리면 건너뛴
     * 기록까지 되돌아가 같은 자리를 다시 밟는다. 부르는 쪽은 {@code DataIntegrityViolationException} 을
     * 받으면 {@link #skipCurrentRank} 를 부르고 다시 시도한다.
     */
    @Transactional
    public Step step(Long drawId) {
        SeatDraw probe = lockDraw(drawId);
        if (!probe.isRevealed()) {
            return Step.IDLE;
        }
        if (probe.getCurrentEntryId() != null) {
            // 구매권을 쥔 사람이 있다. 기한이 지나면 스위퍼가 expireEntry 로 재추첨을 연다
            return Step.IDLE;
        }

        List<Long> ranking = probe.rankingList();
        if (probe.getNextRank() >= ranking.size()) {
            exhaust(probe);
            return Step.EXHAUSTED;
        }

        int rankIndex = probe.getNextRank();
        Long entryId = ranking.get(rankIndex);
        ResaleEntry candidate = resaleEntryRepository.findByIdForUpdate(entryId).orElse(null);
        if (candidate == null || !candidate.isWaiting()) {
            probe.skipRank();
            return Step.SKIPPED;
        }

        /* 후보가 같은 회차에 만료된 선점을 쥐고 있으면 uq_performance_seats_held_by 에 걸린다.
           먼저 치운다. 이 쿼리는 영속성 컨텍스트를 비우므로(clearAutomatically) 아래에서 다시 읽는다 —
           행 락은 이 트랜잭션이 이미 쥐고 있어 다시 읽어도 기다리지 않는다 */
        performanceSeatRepository.releaseExpiredHold(probe.getPerformanceDetailId(), candidate.getUserId());
        SeatDraw draw = lockDraw(drawId);
        ResaleEntry entry = resaleEntryRepository.findByIdForUpdate(entryId).orElseThrow();

        LocalDateTime deadline = LocalDateTime.now().plus(resaleProperties.paymentWindow());
        int updated = performanceSeatRepository.grantSoldToWinner(
                draw.getPerformanceDetailId(), draw.getSeatId(), entry.getUserId(), deadline);
        if (updated == 0) {
            return stopOnSeatMismatch(draw);
        }

        entry.markWon(draw.getSeatId(), draw.getId(), deadline);
        draw.grant(entryId, rankIndex);
        notifyWon(entry, draw, deadline);
        log.info("취소표 당첨 drawId={} rank={} entryId={} userId={} deadline={}",
                drawId, rankIndex + 1, entryId, entry.getUserId(), deadline);
        return Step.GRANTED;
    }

    /** 좌석 UPDATE 가 유니크 제약에 걸렸을 때 — 그 순위를 건너뛴다 */
    @Transactional
    public void skipCurrentRank(Long drawId) {
        SeatDraw draw = lockDraw(drawId);
        if (draw.isRevealed()) {
            log.warn("당첨자가 같은 회차의 다른 좌석을 선점 중이라 건너뜁니다 drawId={} rank={}",
                    drawId, draw.getNextRank() + 1);
            draw.skipRank();
        }
    }

    /**
     * 기한이 지난 당첨을 접는다. 사람은 <b>대기로 돌아가고</b>(다음 표부터 다시 참여), 좌석은 남은
     * 대기자끼리 <b>다시 추첨</b>한다.
     *
     * @return 새로 연 추첨 id — 부르는 쪽이 커밋을 보내야 한다. 결제가 끝났거나(레이스) 대기자가 없으면 empty
     */
    @Transactional
    public Optional<Long> expireEntry(Long entryId, LocalDateTime now) {
        ResaleEntry entry = resaleEntryRepository.findByIdForUpdate(entryId).orElse(null);
        if (entry == null || !entry.isWon() || entry.getDeadlineAt() == null
                || !entry.getDeadlineAt().isBefore(now)) {
            return Optional.empty();
        }
        if (settleIfPurchased(entry)) {
            return Optional.empty();
        }

        Long drawId = entry.getSeatDrawId();
        boolean reclaimed = performanceSeatRepository.reclaimWinnerHold(
                entry.getPerformanceDetailId(), entry.getSeatId(), entry.getUserId()) == 1;
        boolean backToWaiting = returnToWaitingOrExpire(entry);
        notifyExpired(entry, backToWaiting);
        log.info("취소표 당첨 기한 만료 entryId={} userId={} drawId={} waitingAgain={}",
                entryId, entry.getUserId(), drawId, backToWaiting);

        return redraw(drawId, entryId, reclaimed, "결제 기한 만료");
    }

    /**
     * 사용자가 대기를 접는다. 대기 중이면 취소, 당첨이면 포기다.
     *
     * @param rejoin 포기하면서 <b>다시 대기</b>를 고른 경우. 방금 놓친 좌석의 재추첨에는 들어가지 않고
     *               다음 표부터 참가자가 된다
     * @return 포기라서 새 추첨을 열었으면 그 id — 부르는 쪽이 커밋을 보내야 한다
     */
    @Transactional
    public Optional<Long> cancelOrForfeit(Long userId, Long entryId, boolean rejoin) {
        ResaleEntry entry = resaleEntryRepository.findByIdForUpdate(entryId)
                .filter(e -> e.isOwnedBy(userId))
                .orElseThrow(() -> new BusinessException(ResaleErrorCode.ENTRY_NOT_FOUND));
        if (entry.isWaiting()) {
            entry.markCanceled();
            return Optional.empty();
        }
        if (!entry.isWon()) {
            throw new BusinessException(ResaleErrorCode.ENTRY_NOT_CANCELABLE);
        }
        if (settleIfPurchased(entry)) {
            throw new BusinessException(ResaleErrorCode.ENTRY_NOT_CANCELABLE);
        }

        Long drawId = entry.getSeatDrawId();
        boolean reclaimed = performanceSeatRepository.reclaimWinnerHold(
                entry.getPerformanceDetailId(), entry.getSeatId(), entry.getUserId()) == 1;
        boolean waitingAgain = false;
        if (rejoin) {
            waitingAgain = returnToWaitingOrExpire(entry);
        }
        if (!waitingAgain) {
            entry.markForfeited();
        }
        log.info("취소표 당첨 포기 entryId={} userId={} drawId={} waitingAgain={}",
                entryId, userId, drawId, waitingAgain);

        return redraw(drawId, entryId, reclaimed, waitingAgain ? "당첨 포기 (다시 대기)" : "당첨 포기");
    }

    /**
     * 좌석이 팔렸다. 그 좌석의 당첨자였다면 PURCHASED 로 굳힌다. <b>결제 확정 트랜잭션에 합류</b>한다.
     * 당첨자가 아닌 일반 판매면 아무 일도 하지 않는다.
     */
    @Transactional
    public void onSeatSold(Long userId, Long performanceDetailId, Long seatId) {
        if (seatId == null) {
            return;
        }
        resaleEntryRepository.findFirstByUserIdAndPerformanceDetailIdAndSeatIdAndStatus(
                        userId, performanceDetailId, seatId, ResaleEntryStatus.WON)
                .ifPresent(this::settle);
    }

    /**
     * 되살릴 수 없는 추첨(블록해시 창 초과 등)을 접고, 대기자가 남아 있으면 새 키로 다시 연다.
     * 아직 당첨자가 없는 단계(PENDING·OPEN)에서만 온다 — 좌석은 SOLD 그대로다.
     *
     * @return 새로 만든 추첨 id. 대기자가 없어 좌석을 그냥 풀었으면 empty
     */
    @Transactional
    public Optional<Long> failAndReopen(Long drawId, String reason) {
        SeatDraw draw = lockDraw(drawId);
        if (!draw.isPending() && !draw.isOpen()) {
            return Optional.empty();
        }
        draw.markFailed(reason);
        return reopenOrRelease(draw, null, reason);
    }

    /** 취소 마감이 지난 회차의 대기를 LOST 로 접는다 */
    @Transactional
    public int markLostPastDeadline(LocalDateTime cutoff, LocalDateTime now) {
        return resaleEntryRepository.markLostPastDeadline(cutoff, now);
    }

    /* ── 내부 ─────────────────────────────────────────────────── */

    /**
     * 당첨자가 떠난 추첨을 접고 새 회차로 다시 연다.
     *
     * @param seatReclaimed 좌석이 HELD → SOLD 로 되돌아왔는가. 아니면 당첨자가 선점을 스스로 풀어
     *                      좌석이 이미 일반 판매로 나갔다 — 그건 우리 손을 떠난 것이라 재추첨하지 않는다
     */
    private Optional<Long> redraw(Long drawId, Long leaverEntryId, boolean seatReclaimed, String reason) {
        if (drawId == null) {
            return Optional.empty();
        }
        SeatDraw draw = lockDraw(drawId);
        if (!draw.isRevealed()) {
            return Optional.empty();
        }
        if (!seatReclaimed) {
            PerformanceSeat seat = performanceSeatRepository
                    .findById(new PerformanceSeatId(draw.getPerformanceDetailId(), draw.getSeatId()))
                    .orElse(null);
            String state = seat == null ? "missing" : seat.getStatus() + "/held_by=" + seat.getHeldBy();
            draw.markFailed("seat left the draw: " + state);
            log.warn("당첨자 선점이 추첨의 손을 떠나 재추첨하지 않습니다 drawId={} seat={}", drawId, state);
            return Optional.empty();
        }
        draw.markRedrawn(reason);
        return reopenOrRelease(draw, leaverEntryId, reason);
    }

    /**
     * 이미 접힌(REDRAWN·FAILED) 추첨의 좌석을 새 회차로 넘기거나, 대기자가 없으면 일반 판매로 푼다.
     * 부르기 전에 {@code draw} 의 상태는 활성이 아니어야 한다.
     */
    private Optional<Long> reopenOrRelease(SeatDraw draw, Long excludeEntryId, String reason) {
        // 활성 추첨 유니크 인덱스(uq_seat_draws_active_seat) 때문에 접힌 상태가 먼저 DB 에 닿아야 한다.
        // Hibernate 는 INSERT 를 UPDATE 보다 먼저 내보내므로 손으로 flush 한다
        seatDrawRepository.flush();

        List<Long> participants = waitingParticipantIds(
                draw.getPerformanceDetailId(), draw.getAreaId(), excludeEntryId);
        if (participants.isEmpty()) {
            performanceSeatRepository.release(draw.getPerformanceDetailId(), draw.getSeatId());
            log.info("대기자가 없어 좌석을 일반 판매로 풉니다 drawId={} seatId={} reason={}",
                    draw.getId(), draw.getSeatId(), reason);
            return Optional.empty();
        }
        SeatDraw next = seatDrawRepository.save(draw.reopen(participants));
        log.info("취소표 재추첨 drawId={} -> {} key={} participants={} reason={}",
                draw.getId(), next.getId(), next.getDrawKey(), participants.size(), reason);
        return Optional.of(next.getId());
    }

    /**
     * 놓친 당첨자를 대기로 되돌린다. 같은 구역에 이미 새 대기를 걸어 두었으면(부분 유니크 인덱스)
     * 이 행은 EXPIRED 로 끝내고 그 새 대기가 이어받는다.
     *
     * @return 대기로 돌아갔으면 true
     */
    private boolean returnToWaitingOrExpire(ResaleEntry entry) {
        boolean anotherWaiting = resaleEntryRepository.existsByUserIdAndPerformanceDetailIdAndAreaIdAndStatus(
                entry.getUserId(), entry.getPerformanceDetailId(), entry.getAreaId(), ResaleEntryStatus.WAITING);
        if (anotherWaiting) {
            entry.markExpired();
            return false;
        }
        entry.returnToWaiting();
        return true;
    }

    private List<Long> waitingParticipantIds(Long performanceDetailId, Long areaId, Long excludeEntryId) {
        return resaleEntryRepository
                .findByPerformanceDetailIdAndAreaIdAndStatusOrderByIdAsc(
                        performanceDetailId, areaId, ResaleEntryStatus.WAITING)
                .stream()
                .map(ResaleEntry::getId)
                .filter(id -> !id.equals(excludeEntryId))
                .toList();
    }

    private SeatDraw lockDraw(Long drawId) {
        return seatDrawRepository.findByIdForUpdate(drawId)
                .orElseThrow(() -> new BusinessException(ResaleErrorCode.DRAW_NOT_FOUND));
    }

    /** 순위의 참가자가 전부 빠졌다 — 좌석을 일반 판매로 푼다 */
    private void exhaust(SeatDraw draw) {
        performanceSeatRepository.release(draw.getPerformanceDetailId(), draw.getSeatId());
        draw.markExhausted();
        log.info("취소표 추첨 참가자가 전부 빠져 좌석을 풉니다 drawId={} seatId={}", draw.getId(), draw.getSeatId());
    }

    /** 좌석 UPDATE 가 0 행이다 — 좌석이 SOLD 가 아니다. 손으로 확인이 필요하다 */
    private Step stopOnSeatMismatch(SeatDraw draw) {
        PerformanceSeat seat = performanceSeatRepository
                .findById(new PerformanceSeatId(draw.getPerformanceDetailId(), draw.getSeatId()))
                .orElse(null);
        String seatState = seat == null ? "missing" : seat.getStatus() + "/held_by=" + seat.getHeldBy();
        draw.markFailed("seat state mismatch: " + seatState);
        log.error("취소표 추첨이 좌석을 잃었습니다. 손으로 확인이 필요합니다 drawId={} seatId={} seat={}",
                draw.getId(), draw.getSeatId(), seatState);
        return Step.STOPPED;
    }

    /** 당첨 좌석이 이미 이 사람에게 팔렸으면 PURCHASED 로 굳힌다 */
    private boolean settleIfPurchased(ResaleEntry entry) {
        if (entry.getSeatId() == null) {
            return false;
        }
        PerformanceSeat seat = performanceSeatRepository
                .findById(new PerformanceSeatId(entry.getPerformanceDetailId(), entry.getSeatId()))
                .orElse(null);
        if (seat != null && seat.getStatus() == SeatBookingStatus.SOLD
                && entry.getUserId().equals(seat.getHeldBy())) {
            settle(entry);
            return true;
        }
        return false;
    }

    private void settle(ResaleEntry entry) {
        entry.markPurchased();
        if (entry.getSeatDrawId() != null) {
            seatDrawRepository.findByIdForUpdate(entry.getSeatDrawId()).ifPresent(draw -> {
                if (draw.isRevealed()) {
                    draw.markSettled();
                }
            });
        }
        log.info("취소표 당첨 결제 완료 entryId={} userId={} seatId={}", entry.getId(), entry.getUserId(),
                entry.getSeatId());
    }

    private String performanceTitle(Long performanceDetailId) {
        return performanceDetailRepository.findById(performanceDetailId)
                .map(PerformanceDetail::getPerformance)
                .map(p -> p.getTitle())
                .orElse("공연");
    }

    private void notifyWon(ResaleEntry entry, SeatDraw draw, LocalDateTime deadline) {
        String areaCode = areaRepository.findById(draw.getAreaId()).map(Area::getAreaCode).orElse("");
        notificationService.notify(entry.getUserId(), NotificationType.RESALE_WON,
                "취소표 추첨에 당첨됐어요 🎉",
                performanceTitle(draw.getPerformanceDetailId()) + " " + areaCode + "구역 — "
                        + DEADLINE_FORMAT.format(deadline) + " 까지 예매를 마쳐주세요.",
                MY_RESALE_PATH, REF_TYPE_ENTRY, entry.getId());
    }

    private void notifyExpired(ResaleEntry entry, boolean backToWaiting) {
        String tail = backToWaiting
                ? " 대기는 그대로 유지돼 다음 취소표부터 다시 참여합니다."
                : " 같은 구역에 걸어 둔 새 대기가 이어서 참여합니다.";
        notificationService.notify(entry.getUserId(), NotificationType.RESALE_EXPIRED,
                "취소표 결제 기한이 지났어요",
                performanceTitle(entry.getPerformanceDetailId()) + " 당첨 좌석의 결제 기한이 지나 좌석은 다시 추첨됩니다."
                        + tail,
                MY_RESALE_PATH, REF_TYPE_ENTRY, entry.getId());
    }
}
