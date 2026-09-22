package com.teacat.server.reward.repository;

import com.teacat.server.reward.entity.MemoryGameSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MemoryGameSessionRepository extends JpaRepository<MemoryGameSession, Long> {

    /**
     * 그날의 랭킹. <b>사람마다 가장 빠른 판 하나</b>만 올라간다 — 여러 번 하면 순위표를 혼자
     * 채우게 되고, 그건 랭킹이 아니라 시도 횟수표다.
     *
     * <p>같은 기록이면 <b>먼저 세운 쪽</b>이 앞이다. 나중에 같은 시간을 낸 사람이 1등을 뺏으면
     * 이미 1등이라고 본 화면이 뒤집힌다.
     *
     * @param limit 상위 몇 명까지
     */
    @Query(value = """
            SELECT ROW_NUMBER() OVER (ORDER BY best.elapsed_ms, best.cleared_at) AS "rank",
                   best.user_id    AS "userId",
                   u.nickname      AS "nickname",
                   best.elapsed_ms AS "elapsedMs",
                   best.moves      AS "moves",
                   best.cleared_at AS "clearedAt"
              FROM (
                    SELECT DISTINCT ON (s.user_id)
                           s.user_id, s.elapsed_ms, s.moves, s.cleared_at
                      FROM memory_game_sessions s
                     WHERE s.played_on = :playedOn
                       AND s.elapsed_ms IS NOT NULL
                     ORDER BY s.user_id, s.elapsed_ms, s.cleared_at
                   ) best
              JOIN users u ON u.id = best.user_id
             ORDER BY best.elapsed_ms, best.cleared_at
             LIMIT :limit
            """, nativeQuery = true)
    List<MemoryRankRow> findRanking(@Param("playedOn") LocalDate playedOn, @Param("limit") int limit);

    /**
     * 그날 1등 한 명. 다음날 보상을 줄 대상이다.
     *
     * <p>{@link #findRanking} 과 <b>같은 정렬</b>이어야 한다 — 화면이 보여준 1등과 돈을 받는 사람이
     * 다르면 그건 버그가 아니라 사고다. 그래서 같은 쿼리를 한 줄로 잘라 쓴다.
     */
    default Optional<MemoryRankRow> findWinner(LocalDate playedOn) {
        return findRanking(playedOn, 1).stream().findFirst();
    }

    /** 내 그날 최고 기록과 등수. 순위표 밖이어도 "나는 몇 등" 을 보여주려면 따로 물어야 한다 */
    @Query(value = """
            SELECT ranked."rank", ranked."userId", ranked."nickname",
                   ranked."elapsedMs", ranked."moves", ranked."clearedAt"
              FROM (
                    SELECT ROW_NUMBER() OVER (ORDER BY best.elapsed_ms, best.cleared_at) AS "rank",
                           best.user_id    AS "userId",
                           u.nickname      AS "nickname",
                           best.elapsed_ms AS "elapsedMs",
                           best.moves      AS "moves",
                           best.cleared_at AS "clearedAt"
                      FROM (
                            SELECT DISTINCT ON (s.user_id)
                                   s.user_id, s.elapsed_ms, s.moves, s.cleared_at
                              FROM memory_game_sessions s
                             WHERE s.played_on = :playedOn
                               AND s.elapsed_ms IS NOT NULL
                             ORDER BY s.user_id, s.elapsed_ms, s.cleared_at
                           ) best
                      JOIN users u ON u.id = best.user_id
                   ) ranked
             WHERE ranked."userId" = :userId
            """, nativeQuery = true)
    Optional<MemoryRankRow> findMyRank(@Param("playedOn") LocalDate playedOn,
                                       @Param("userId") Long userId);

    /** 랭킹 한 줄 */
    interface MemoryRankRow {
        int getRank();

        Long getUserId();

        String getNickname();

        int getElapsedMs();

        int getMoves();

        java.time.LocalDateTime getClearedAt();
    }
}
