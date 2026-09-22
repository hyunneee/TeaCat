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

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 같이 하는 게임 한 판.
 *
 * <p>진행 중 게임판의 <b>진실은 {@link #state} 하나뿐이다.</b> 서버 메모리에 두지 않는
 * 이유는 두 가지다 — 재시작하면 판이 날아가는데 판돈은 묶여 있고, 할리갈리의 종 치기는
 * 누가 먼저인지를 판정해야 해서 줄을 세울 곳이 필요하다. 행 잠금이 둘 다 해결한다.
 */
@Entity
@Table(name = "game_rooms")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GameRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "invite_code", nullable = false, length = 8)
    private String inviteCode;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "game_type", nullable = false, updatable = false, columnDefinition = "game_type")
    private GameType gameType;

    @Column(name = "host_user_id", nullable = false)
    private Long hostUserId;

    @Column(name = "bet_amount", nullable = false)
    private long betAmount;

    @Column(name = "max_players", nullable = false)
    private int maxPlayers;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "game_room_status")
    private GameRoomStatus status;

    /**
     * 게임판 전체.
     *
     * <p>타입 있는 record 가 아니라 Map 인 이유는 컬럼 하나에 게임 두 종류가 들어가기
     * 때문이다. 엔진이 ObjectMapper 로 자기 타입으로 바꿔 쓴다 (GameStateCodec).
     * 매핑 방식은 {@code NftTradeReview.analysis} 와 같다.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "state", columnDefinition = "jsonb")
    private Map<String, Object> state;

    @Column(name = "prize_pool", nullable = false)
    private long prizePool;

    @Column(name = "subsidy", nullable = false)
    private long subsidy;

    @Column(name = "turn_expires_at")
    private LocalDateTime turnExpiresAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private GameRoom(String inviteCode, GameType gameType, Long hostUserId, long betAmount, int maxPlayers) {
        this.inviteCode = inviteCode;
        this.gameType = gameType;
        this.hostUserId = hostUserId;
        this.betAmount = betAmount;
        this.maxPlayers = maxPlayers;
        this.status = GameRoomStatus.WAITING;
    }

    public static GameRoom open(String inviteCode, GameType gameType, Long hostUserId, long betAmount, int maxPlayers) {
        return new GameRoom(inviteCode, gameType, hostUserId, betAmount, maxPlayers);
    }

    public void start(Map<String, Object> initialState, Duration turnLimit) {
        this.status = GameRoomStatus.PLAYING;
        this.state = initialState;
        this.startedAt = LocalDateTime.now();
        extendTurn(turnLimit);
    }

    public void updateState(Map<String, Object> next, Duration turnLimit) {
        this.state = next;
        extendTurn(turnLimit);
    }

    /** 턴 시한을 다시 잡는다. 아무도 진행시키지 않는 판을 스위퍼가 알아보려면 이 값이 있어야 한다 */
    public void extendTurn(Duration turnLimit) {
        this.turnExpiresAt = turnLimit == null ? null : LocalDateTime.now().plus(turnLimit);
    }

    public void finish(Map<String, Object> finalState, long prizePool, long subsidy) {
        this.status = GameRoomStatus.FINISHED;
        this.state = finalState;
        this.prizePool = prizePool;
        this.subsidy = subsidy;
        this.turnExpiresAt = null;
        this.finishedAt = LocalDateTime.now();
    }

    public void abort() {
        this.status = GameRoomStatus.ABORTED;
        this.turnExpiresAt = null;
        this.finishedAt = LocalDateTime.now();
    }

    /** 방장이 나가면 남은 사람 중 가장 앞자리가 이어받는다. 방장 없는 방은 시작시킬 사람이 없다 */
    public void handOverHost(Long newHostUserId) {
        this.hostUserId = newHostUserId;
    }

    public boolean isHost(Long userId) {
        return hostUserId.equals(userId);
    }

    /** 판돈이 0이면 연습 모드다 — 홀드도, 상금도, 보조금도 없다 */
    public boolean isPractice() {
        return betAmount == 0;
    }
}
