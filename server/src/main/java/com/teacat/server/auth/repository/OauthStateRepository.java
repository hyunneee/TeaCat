package com.teacat.server.auth.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;

/**
 * OAuth state 저장소 (Redis).
 *
 * 우리가 시작한 인가 요청인지 확인하는 일회용 값이다(CSRF 방지).
 * 한 번 쓰면 지워서 재사용을 막는다.
 */
@Repository
@RequiredArgsConstructor
public class OauthStateRepository {

    private static final String KEY_PREFIX = "oauth:state:";
    private static final String PRESENT = "1";

    private final StringRedisTemplate redisTemplate;

    public void save(String state, Duration ttl) {
        redisTemplate.opsForValue().set(key(state), PRESENT, ttl);
    }

    /** 존재하면 지우고 true. 같은 state 로 두 번 통과할 수 없다 */
    public boolean consume(String state) {
        return Boolean.TRUE.equals(redisTemplate.delete(key(state)));
    }

    private String key(String state) {
        return KEY_PREFIX + state;
    }
}
