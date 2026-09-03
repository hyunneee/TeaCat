package com.teacat.server.auth.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.Optional;

/**
 * 리프레시 토큰 저장소 (Redis).
 *
 * key = {@code refresh:{token}}, value = userId, TTL = 리프레시 토큰 유효기간.
 * TTL 이 곧 만료라서 별도의 만료 검사나 정리 배치가 필요 없고,
 * 값을 지우는 것만으로 즉시 무효화(로그아웃 · 회전)가 된다.
 */
@Repository
@RequiredArgsConstructor
public class RefreshTokenRepository {

    private static final String KEY_PREFIX = "refresh:";

    private final StringRedisTemplate redisTemplate;

    public void save(String token, Long userId, Duration ttl) {
        redisTemplate.opsForValue().set(key(token), String.valueOf(userId), ttl);
    }

    public Optional<Long> findUserId(String token) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(key(token)))
                .map(Long::valueOf);
    }

    public void delete(String token) {
        redisTemplate.delete(key(token));
    }

    private String key(String token) {
        return KEY_PREFIX + token;
    }
}
