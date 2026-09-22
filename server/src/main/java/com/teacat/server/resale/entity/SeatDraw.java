package com.teacat.server.resale.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 취소된 좌석 하나에 대한 온체인 추첨.
 *
 * <p>체인이 만드는 것은 난수 하나다. 참가자 목록은 커밋 시점에 {@code participantIds} 로 굳어
 * {@code inputsHash} 에 묶이고, 난수가 확정되면 순위 {@code ranking} 은 그 둘로부터 계산되는
 * 순수 함수다 — 누가 계산하든 같다. 그래서 여기 저장해 두고 순서대로 구매권을 넘긴다.
 */
@Entity
@Table(name = "seat_draws")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SeatDraw {

    private static final String SEPARATOR = ",";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "performance_id", nullable = false)
    private Long performanceId;

    @Column(name = "performance_detail_id", nullable = false)
    private Long performanceDetailId;

    @Column(name = "area_id", nullable = false)
    private Long areaId;

    @Column(name = "seat_id", nullable = false)
    private Long seatId;

    @Column(name = "draw_no", nullable = false)
    private int drawNo;

    @Column(name = "draw_key", nullable = false, length = 200)
    private String drawKey;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "seat_draw_status")
    private SeatDrawStatus status;

    @Column(name = "participant_ids", nullable = false, columnDefinition = "text")
    private String participantIds;

    @Column(name = "inputs_hash", length = 66)
    private String inputsHash;

    @Column(name = "open_tx_hash", length = 66)
    private String openTxHash;

    @Column(name = "randomness", length = 66)
    private String randomness;

    @Column(name = "ranking", columnDefinition = "text")
    private String ranking;

    @Column(name = "next_rank", nullable = false)
    private int nextRank;

    @Column(name = "current_entry_id")
    private Long currentEntryId;

    @Column(name = "source_ticket_order_id")
    private Long sourceTicketOrderId;

    @Column(name = "failure_reason", length = 200)
    private String failureReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private SeatDraw(Long performanceId, Long performanceDetailId, Long areaId, Long seatId,
                     int drawNo, List<Long> participantIds, Long sourceTicketOrderId) {
        this.performanceId = performanceId;
        this.performanceDetailId = performanceDetailId;
        this.areaId = areaId;
        this.seatId = seatId;
        this.drawNo = drawNo;
        this.drawKey = drawKeyOf(performanceId, performanceDetailId, seatId, drawNo);
        this.status = SeatDrawStatus.PENDING;
        this.participantIds = join(participantIds);
        this.nextRank = 0;
        this.sourceTicketOrderId = sourceTicketOrderId;
    }

    /**
     * 첫 추첨. 참가자는 <b>오름차순</b>이어야 한다 — 체인이 순서를 검사하고 inputsHash 가 순서에 민감하다.
     */
    public static SeatDraw open(Long performanceId, Long performanceDetailId, Long areaId, Long seatId,
                                List<Long> participantIds, Long sourceTicketOrderId) {
        return new SeatDraw(performanceId, performanceDetailId, areaId, seatId, 1, participantIds,
                sourceTicketOrderId);
    }

    /** 실패한 추첨을 이어받는 다음 회차. 같은 좌석, draw_no + 1 */
    public SeatDraw reopen(List<Long> participantIds) {
        return new SeatDraw(performanceId, performanceDetailId, areaId, seatId, drawNo + 1,
                participantIds, sourceTicketOrderId);
    }

    /**
     * 체인에 보내는 키. 공연 id 를 넣어 <b>같은 공연·좌석에 추첨이 몇 번 열렸는지 눈에 띄게</b> 한다.
     * 재추첨을 숨길 수 없다는 것이 이 설계가 주는 정직성이다. (PHOTOCARD_PLAN.md 4-9)
     */
    static String drawKeyOf(Long performanceId, Long performanceDetailId, Long seatId, int drawNo) {
        return "resale:p" + performanceId + ":d" + performanceDetailId + ":s" + seatId + ":n" + drawNo;
    }

    public List<Long> participantIdList() {
        return split(participantIds);
    }

    public List<Long> rankingList() {
        return split(ranking);
    }

    public boolean isPending() {
        return status == SeatDrawStatus.PENDING;
    }

    public boolean isOpen() {
        return status == SeatDrawStatus.OPEN;
    }

    public boolean isRevealed() {
        return status == SeatDrawStatus.REVEALED;
    }

    /** 커밋을 보냈다. txHash 는 이미 열려 있던 것을 뒤늦게 알았을 때 null 일 수 있다 */
    public void markOpened(String txHash, String inputsHash) {
        this.status = SeatDrawStatus.OPEN;
        this.openTxHash = txHash;
        this.inputsHash = inputsHash;
    }

    /** 커밋이 체인에 실리지 않았다. 다시 보낼 수 있게 되돌린다 */
    public void resetToPending() {
        this.status = SeatDrawStatus.PENDING;
        this.openTxHash = null;
    }

    public void markRevealed(String randomness, List<Long> ranking) {
        this.status = SeatDrawStatus.REVEALED;
        this.randomness = randomness;
        this.ranking = join(ranking);
        this.nextRank = 0;
    }

    /** 순위 하나를 건너뛴다 (이미 다른 좌석에 당첨됐거나 대기를 접은 참가자) */
    public void skipRank() {
        this.nextRank++;
    }

    /** {@code rankIndex} 순위의 참가자에게 구매권을 넘겼다 */
    public void grant(Long entryId, int rankIndex) {
        this.currentEntryId = entryId;
        this.nextRank = rankIndex + 1;
    }

    public void markSettled() {
        this.status = SeatDrawStatus.SETTLED;
    }

    /** 당첨자가 기한을 넘기거나 포기했다. 좌석은 되돌아갔고 새 회차가 이어받는다 */
    public void markRedrawn(String reason) {
        this.status = SeatDrawStatus.REDRAWN;
        this.failureReason = reason;
    }

    public void markExhausted() {
        this.status = SeatDrawStatus.EXHAUSTED;
    }

    public void markFailed(String reason) {
        this.status = SeatDrawStatus.FAILED;
        this.failureReason = truncate(reason);
    }

    /**
     * 커밋을 보내지 못했다. <b>상태는 PENDING 그대로</b> 두고 사유만 남긴다.
     *
     * <p>이 한 줄이 두 가지를 한다. 하나는 왜 멈췄는지 DB 에서 바로 보이게 하는 것
     * ({@code select status, failure_reason from seat_draws}), 다른 하나는 {@code @UpdateTimestamp}
     * 로 {@code updated_at} 을 올려 스위퍼의 재시도 간격이 실제로 지켜지게 하는 것이다 —
     * 예전에는 실패해도 행이 그대로라 {@code updated_at} 이 안 올라가, 한번 막히면 스위퍼 주기마다
     * (5초) 블록체인 API 를 두드렸다.
     */
    public void recordOpenFailure(String reason) {
        this.failureReason = truncate(reason);
    }

    private static String truncate(String reason) {
        return reason == null ? null : reason.substring(0, Math.min(reason.length(), 200));
    }

    private static String join(List<Long> ids) {
        return ids.stream().map(String::valueOf).collect(Collectors.joining(SEPARATOR));
    }

    private static List<Long> split(String joined) {
        if (joined == null || joined.isBlank()) {
            return List.of();
        }
        return Arrays.stream(joined.split(SEPARATOR)).map(Long::valueOf).toList();
    }
}
