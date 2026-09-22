package com.teacat.server.reward.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 포토카드 짝 맞추기 한 판.
 *
 * <p>🔴 <b>걸린 시간은 서버가 잰다.</b> 시작할 때 행을 만들고, 클리어를 받을 때 그때의 서버 시각에서
 * {@code startedAt} 을 빼서 넣는다. 화면이 보낸 숫자를 믿으면 콘솔에서 0.1초를 적어 넣고 매일
 * 1등을 가져간다 — 금액의 출처가 서버여야 하는 것과 같은 이유다.
 *
 * <p>클리어하지 못한 판은 {@code clearedAt} 이 비어 랭킹에 들지 않는다. 지우지도 않는다 —
 * 몇 판 만에 깼는지는 나중에 볼 값이고, 지우면 "시작은 했는데 안 깬" 기록이 사라진다.
 */
@Entity
@Table(name = "memory_game_sessions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MemoryGameSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 랭킹을 가르는 날짜. <b>시작한 날</b>이다 — 자정을 걸쳐 끝난 판이 다음 날 랭킹에 끼지 않게 */
    @Column(name = "played_on", nullable = false)
    private LocalDate playedOn;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "cleared_at")
    private LocalDateTime clearedAt;

    @Column(name = "elapsed_ms")
    private Integer elapsedMs;

    @Column(name = "moves")
    private Integer moves;

    private MemoryGameSession(Long userId, LocalDateTime startedAt) {
        this.userId = userId;
        this.startedAt = startedAt;
        this.playedOn = startedAt.toLocalDate();
    }

    public static MemoryGameSession start(Long userId, LocalDateTime startedAt) {
        return new MemoryGameSession(userId, startedAt);
    }

    public boolean isCleared() {
        return clearedAt != null;
    }

    public boolean isOwnedBy(Long userId) {
        return this.userId.equals(userId);
    }

    /**
     * 클리어를 기록한다. 걸린 시간은 <b>여기서 계산한다</b> — 인자로 받지 않는다.
     *
     * @param moves 뒤집은 횟수. 순위에 쓰지 않으므로 화면이 보낸 값을 그대로 둔다
     */
    public void clear(LocalDateTime clearedAt, int moves) {
        this.clearedAt = clearedAt;
        this.moves = moves;
        long millis = Duration.between(startedAt, clearedAt).toMillis();
        /* 0 이하는 DB 제약(chk_memory_game_sessions_elapsed)에 걸린다. 시계가 뒤로 간 드문 경우라
           1ms 로 올려 기록만 남긴다 — 그 판이 1등이 되겠지만, 판을 통째로 잃는 것보다 낫고
           서버 시계가 뒤로 갔다는 건 그 자체로 봐야 할 사고다 */
        this.elapsedMs = (int) Math.min(Integer.MAX_VALUE, Math.max(1L, millis));
    }
}
