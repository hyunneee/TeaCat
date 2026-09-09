package com.teacat.server.analytics.repository;

import com.teacat.server.analytics.entity.DailyActiveUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 하루 접속 기록.
 *
 * <p>🔴 집계는 전부 네이티브 쿼리이고 {@code users} 를 직접 조인한다. JPQL 로 {@code User} 를
 * 조인하면 {@code @SQLRestriction("deleted_at is null")} 이 붙어서, 어제 접속했던 사람이
 * 오늘 탈퇴하면 <b>어제의 접속자 수까지 줄어든다.</b> 지난 통계는 바뀌면 안 된다.
 *
 * <p>🔴 세는 대상은 {@code role = 'USER'} 뿐이다. 운영진(ADMIN·STADIUM·PERFORMANCE)이
 * 어드민 화면을 보는 것은 서비스 이용이 아니다. 기록은 남기되 집계에서만 뺀다 —
 * 나중에 기준을 바꾸고 싶어지면 쿼리만 고치면 된다.
 */
public interface DailyActiveUserRepository extends JpaRepository<DailyActiveUser, Long> {

    /**
     * 오늘 첫 접속을 기록한다. 이미 있으면 아무 일도 없다.
     *
     * <p>Redis 로 한 번 걸러 부르지만 그것만 믿을 수는 없다 (Redis 재시작·flush, 서버 여러 대).
     * 유니크 제약이 최종 방어선이고, 여기서 예외가 나면 요청이 실패하므로
     * {@code ON CONFLICT DO NOTHING} 으로 조용히 넘긴다.
     *
     * <p>{@code @Transactional} 을 메서드에 직접 건다. 부르는 쪽(필터)은 트랜잭션 밖이고,
     * 예외가 나도 요청을 죽이면 안 되기 때문이다 — 경계가 이 호출 안에서 닫혀야
     * 부르는 쪽이 try-catch 로 삼킬 수 있다.
     *
     * @return 실제로 들어간 행 수 (0 이면 이미 기록돼 있던 것)
     */
    @Transactional
    @Modifying
    @Query(value = """
            INSERT INTO daily_active_users (user_id, visit_date)
            VALUES (:userId, CAST(:visitDate AS date))
            ON CONFLICT (user_id, visit_date) DO NOTHING
            """, nativeQuery = true)
    int recordVisit(@Param("userId") Long userId, @Param("visitDate") LocalDate visitDate);

    /** 일자별 접속자 수. 접속이 없던 날은 행이 없다 */
    @Query(value = """
            SELECT d.visit_date AS bucket, COUNT(*) AS total
              FROM daily_active_users d
              JOIN users u ON u.id = d.user_id
             WHERE u.role = 'USER'
               AND d.visit_date >= CAST(:from AS date)
               AND d.visit_date <= CAST(:to AS date)
             GROUP BY d.visit_date
            """, nativeQuery = true)
    List<DailyCountProjection> countDailyActive(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * 기간 내 순 접속자 수 (중복 제거). WAU·MAU 가 쓴다.
     *
     * <p>일자별 합계를 더하면 안 된다 — 사흘 연속 온 한 사람이 3 명이 된다.
     */
    @Query(value = """
            SELECT COUNT(DISTINCT d.user_id)
              FROM daily_active_users d
              JOIN users u ON u.id = d.user_id
             WHERE u.role = 'USER'
               AND d.visit_date >= CAST(:from AS date)
               AND d.visit_date <= CAST(:to AS date)
            """, nativeQuery = true)
    long countUniqueActive(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * 기간 내 접속자 중, <b>그 기간 이전에도</b> 온 적이 있는 사람 수.
     *
     * <p>{@code countUniqueActive} 로 나누면 재방문율이 된다. 한 번 왔다 마는 서비스인지
     * 다시 오는 서비스인지를 보는 값이라, 신규 유입이 몰린 날에도 흔들리지 않는다.
     */
    @Query(value = """
            SELECT COUNT(DISTINCT d.user_id)
              FROM daily_active_users d
              JOIN users u ON u.id = d.user_id
             WHERE u.role = 'USER'
               AND d.visit_date >= CAST(:from AS date)
               AND d.visit_date <= CAST(:to AS date)
               AND EXISTS (SELECT 1
                             FROM daily_active_users prev
                            WHERE prev.user_id = d.user_id
                              AND prev.visit_date < CAST(:from AS date))
            """, nativeQuery = true)
    long countReturningActive(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * 접속 기록이 시작된 날. 아직 한 건도 없으면 {@code null}.
     *
     * <p>🔴 이 값이 필요한 이유 — 가입은 소급 집계가 되지만 <b>접속은 안 된다.</b>
     * 이 기능을 배포하기 전 날짜의 접속자 수는 0 으로 나오는데, 그건 "아무도 안 왔다" 가
     * 아니라 "재지 않았다" 다. 프론트가 그 구간을 구분해서 그릴 수 있게 내려준다.
     */
    @Query(value = "SELECT MIN(d.visit_date) FROM daily_active_users d", nativeQuery = true)
    LocalDate findEarliestVisitDate();
}
