package com.teacat.server.reward.repository;

import com.teacat.server.reward.entity.DailyReward;
import com.teacat.server.reward.entity.RewardType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyRewardRepository extends JpaRepository<DailyReward, Long> {

    Optional<DailyReward> findByUserIdAndRewardTypeAndRewardDate(Long userId, RewardType rewardType,
                                                                 LocalDate rewardDate);

    /** 오늘 받은 것 전부. 종류가 둘뿐이라 한 번에 읽고 화면이 나눠 쓴다 */
    List<DailyReward> findByUserIdAndRewardDate(Long userId, LocalDate rewardDate);

    /**
     * 한 달치 기록. 출석 달력이 쓴다.
     *
     * <p>{@code to} 는 <b>포함하지 않는다</b>(다음 달 1일). 말일이 28·30·31 로 달라서
     * 경계를 여기서 계산하면 윤년마다 틀린다 — 부르는 쪽이 {@code plusMonths(1)} 로 준다.
     */
    List<DailyReward> findByUserIdAndRewardTypeAndRewardDateGreaterThanEqualAndRewardDateLessThanOrderByRewardDate(
            Long userId, RewardType rewardType, LocalDate from, LocalDate to);

    default List<DailyReward> findMonth(Long userId, RewardType rewardType, LocalDate firstDay) {
        return findByUserIdAndRewardTypeAndRewardDateGreaterThanEqualAndRewardDateLessThanOrderByRewardDate(
                userId, rewardType, firstDay, firstDay.plusMonths(1));
    }

    /**
     * 이 날짜부터 거꾸로 이어진 출석 일수(연속 출석).
     *
     * <p>🔴 화면에서 세지 않는다. 날짜 계산은 자정 경계·시간대 때문에 기기 시계로 하면
     * 사람마다 다르게 나온다. 서버(Asia/Seoul) 기준으로 한 번만 센다.
     */
    /*
     * 연속된 날짜는 "날짜 + 몇 번째" 가 같다는 성질을 쓴다. 내림차순으로 세면 순번이
     * 하나 오를 때 날짜가 하루 내려가므로 둘을 더하면 상수가 된다.
     * 그 값(anchor)이 같은 것끼리 묶으면 한 묶음이 곧 한 번의 연속 출석이다.
     *
     * 🔴 마지막 출석이 **어제보다 예전이면 0** 이다. 그 조건이 없으면 일주일 전에 닷새
     *    연속했던 사람이 오늘도 "5일 연속" 으로 보인다. 오늘을 아직 안 눌렀을 수 있으므로
     *    어제까지는 살아 있는 것으로 본다.
     */
    @Query(value = """
            WITH days AS (
                SELECT reward_date,
                       reward_date + (row_number() OVER (ORDER BY reward_date DESC) - 1)::int AS anchor
                  FROM daily_rewards
                 WHERE user_id = :userId
                   AND reward_type = 'ATTENDANCE'
                   AND reward_date <= CAST(:today AS date)
            ), runs AS (
                SELECT anchor, count(*) AS len, max(reward_date) AS last_day
                  FROM days GROUP BY anchor
            )
            SELECT COALESCE((SELECT len FROM runs
                              WHERE last_day >= CAST(:today AS date) - 1
                              ORDER BY last_day DESC LIMIT 1), 0)
            """, nativeQuery = true)
    long countStreakUntil(@Param("userId") Long userId, @Param("today") LocalDate today);
}
