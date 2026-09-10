package com.teacat.server.analytics.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * "이 회원 오늘 이미 셌나" 를 기억하는 Redis 표식.
 *
 * <p>접속 기록은 <b>인증된 요청마다</b> 후보가 된다. 한 사람이 하루에 수백 번 부르는데
 * 그때마다 DB 에 INSERT 를 날릴 수는 없다. 첫 번째만 통과시키고 나머지는 Redis 에서 끝낸다
 * — 사람당 하루 DB 쓰기 한 번이다.
 *
 * <p>키는 자정에 사라진다. TTL 을 하루 고정(24h)으로 주면 오후에 처음 온 사람의 표식이
 * 다음 날 오후까지 남아 <b>다음 날 접속이 통째로 누락된다.</b>
 *
 * <p>이 캐시는 성능을 위한 것이지 정확성을 위한 것이 아니다. Redis 가 비어도
 * {@code uq_daily_active_users_user_date} 가 중복을 막는다.
 */
@Repository
@RequiredArgsConstructor
public class DailyVisitCacheRepository {

    private static final String KEY_PREFIX = "dau:";

    /**
     * 자정 직후의 시계 오차·경합으로 TTL 이 0 이하로 계산되는 것을 막는 하한.
     * Redis 는 만료가 이미 지난 SET 을 즉시 삭제해버려서, 그러면 표식이 없는 것과 같아진다.
     */
    private static final Duration MIN_TTL = Duration.ofSeconds(10);

    private final StringRedisTemplate redisTemplate;

    /**
     * 오늘 처음 보는 회원이면 표식을 남기고 {@code true}.
     *
     * @return 이미 표식이 있으면 {@code false} (DB 를 건드릴 필요 없음)
     */
    public boolean markFirstVisit(Long userId, LocalDate date) {
        Boolean marked = redisTemplate.opsForValue()
                .setIfAbsent(key(userId, date), "1", ttlUntilMidnight(date));

        return Boolean.TRUE.equals(marked);
    }

    private Duration ttlUntilMidnight(LocalDate date) {
        Duration remaining = Duration.between(LocalDateTime.now(), date.plusDays(1).atStartOfDay());

        return remaining.compareTo(MIN_TTL) < 0 ? MIN_TTL : remaining;
    }

    private String key(Long userId, LocalDate date) {
        return KEY_PREFIX + date + ":" + userId;
    }
}
