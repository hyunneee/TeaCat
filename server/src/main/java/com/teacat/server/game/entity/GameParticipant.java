package com.teacat.server.game.entity;

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

/**
 * 한 판에 앉은 사람 하나.
 *
 * <p>{@link #seatNo} 가 게임판 state 안에서 이 사람을 가리키는 인덱스다. 사람이 나가도
 * 자리 번호는 비워 두고 재사용하지 않는다 — 진행 중인 판의 말·카드가 자리 번호로 묶여
 * 있어서 번호를 다시 쓰면 남의 말이 내 것이 된다.
 */
@Entity
@Table(name = "game_participants")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GameParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_id", nullable = false, updatable = false)
    private Long roomId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "seat_no", nullable = false, updatable = false)
    private int seatNo;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "game_participant_status")
    private GameParticipantStatus status;

    @Column(name = "ready", nullable = false)
    private boolean ready;

    /** 고른 말 모양. 아직 안 골랐으면 null 이고, 시작할 때 남은 모양 중 하나가 채워진다 */
    @Enumerated(EnumType.STRING)
    @Column(name = "piece_style", length = 20)
    private GamePieceStyle pieceStyle;

    @Column(name = "bet", nullable = false)
    private long bet;

    @Column(name = "rank")
    private Integer rank;

    @Column(name = "payout")
    private Long payout;

    @Column(name = "subsidy_share", nullable = false)
    private long subsidyShare;

    @Column(name = "settled_at")
    private LocalDateTime settledAt;

    @Column(name = "chain_settled_at")
    private LocalDateTime chainSettledAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private GameParticipant(Long roomId, Long userId, int seatNo) {
        this.roomId = roomId;
        this.userId = userId;
        this.seatNo = seatNo;
        this.status = GameParticipantStatus.JOINED;
    }

    public static GameParticipant join(Long roomId, Long userId, int seatNo) {
        return new GameParticipant(roomId, userId, seatNo);
    }

    public void toggleReady(boolean value) {
        this.ready = value;
    }

    public void choosePieceStyle(GamePieceStyle style) {
        this.pieceStyle = style;
    }

    /** 방의 판돈을 베껴 온다. 시작 뒤에 방 설정이 바뀌어도 이 판의 판돈은 그대로여야 한다 */
    public void startPlaying(long betAmount) {
        this.status = GameParticipantStatus.PLAYING;
        this.bet = betAmount;
        this.ready = false;
    }

    /**
     * 중간에 나갔다.
     *
     * <p>판돈은 돌려주지 않는다. 돌려주면 지고 있을 때 나가면 그만이라, 남은 사람이 딸 돈이
     * 사라진다. 정산에서 꼴찌로 처리한다.
     */
    public void retire() {
        if (status.isAlive()) {
            this.status = GameParticipantStatus.RETIRED;
        }
    }

    public void finishPlaying() {
        if (status == GameParticipantStatus.PLAYING) {
            this.status = GameParticipantStatus.FINISHED;
        }
    }

    /**
     * 정산 결과를 적는다.
     *
     * @return 이 호출로 적혔으면 true. 이미 정산됐으면 false — 예외가 아니다(멱등)
     */
    public boolean settle(int rank, long payout, long subsidyShare) {
        if (this.payout != null) {
            return false;
        }
        this.rank = rank;
        this.payout = payout;
        this.subsidyShare = subsidyShare;
        this.settledAt = LocalDateTime.now();
        return true;
    }

    public boolean isSettled() {
        return payout != null;
    }

    /** 순손익을 체인에 반영하고 홀드까지 풀었다 */
    public void markChainSettled() {
        this.chainSettledAt = LocalDateTime.now();
    }

    public boolean isChainSettled() {
        return chainSettledAt != null;
    }

    /** 정산에서 체인을 움직여야 하는 금액. 양수면 발행, 음수면 소각, 0이면 아무것도 안 한다 */
    public long netDelta() {
        return (payout == null ? 0 : payout) - bet;
    }
}
