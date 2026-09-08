package com.teacat.server.auth.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;

/**
 * 리프레시 토큰 저장소 (Redis).
 *
 * <p>키를 두 벌 둔다.
 * <pre>
 *   refresh:{token}        -> userId        토큰 하나를 검증할 때 (재발급)
 *   refresh:user:{userId}  -> {token, ...}  한 사용자의 토큰을 모두 찾을 때 (비번 변경·탈퇴)
 * </pre>
 *
 * <p>정방향 키만 있으면 "이 사용자의 모든 세션 끊기" 를 할 수 없다.
 * 토큰에서 userId 는 찾아지지만 userId 에서 토큰들을 찾을 방법이 없기 때문이다.
 * 그래서 역방향 인덱스를 함께 둔다.
 *
 * <p>TTL 이 곧 만료라서 별도의 만료 검사나 정리 배치가 필요 없고,
 * 값을 지우는 것만으로 즉시 무효화(로그아웃 · 회전 · 전체 폐기)가 된다.
 *
 * <p>역방향 Set 에는 이미 만료된 토큰이 남아 있을 수 있다(개별 TTL 로 먼저 사라짐).
 * 지울 때 없는 키를 지우는 것은 무해하고, Set 자체도 발급할 때마다 TTL 이 갱신되므로
 * 마지막 발급 후 유효기간이 지나면 통째로 사라진다. 정리 배치가 필요하지 않다.
 */
@Repository
@RequiredArgsConstructor
public class RefreshTokenRepository {

    private static final String KEY_PREFIX = "refresh:";
    private static final String USER_KEY_PREFIX = "refresh:user:";

    private final StringRedisTemplate redisTemplate;

    public void save(String token, Long userId, Duration ttl) {
        redisTemplate.opsForValue().set(key(token), String.valueOf(userId), ttl);

        // 같은 사용자의 토큰을 나중에 한 번에 찾기 위한 역방향 인덱스.
        // Set 의 TTL 은 발급할 때마다 늘어난다 — 가장 늦게 발급된 토큰보다 먼저 사라지면 안 된다.
        redisTemplate.opsForSet().add(userKey(userId), token);
        redisTemplate.expire(userKey(userId), ttl);
    }

    public Optional<Long> findUserId(String token) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(key(token)))
                .map(Long::valueOf);
    }

    /**
     * 토큰 하나를 폐기한다 (로그아웃 · 회전).
     *
     * 역방향 인덱스에서도 빼야 한다. 남겨두면 나중에 전체 폐기가 이미 없는 키를 훑는다.
     */
    public void delete(String token) {
        findUserId(token).ifPresent(userId -> redisTemplate.opsForSet().remove(userKey(userId), token));
        redisTemplate.delete(key(token));
    }

    /**
     * 한 사용자의 리프레시 토큰을 전부 폐기한다 (비밀번호 변경 · 탈퇴).
     *
     * 다른 기기에 남아 있는 세션을 즉시 끊는 것이 목적이다.
     */
    public void deleteAllByUser(Long userId) {
        Set<String> tokens = redisTemplate.opsForSet().members(userKey(userId));

        if (tokens != null && !tokens.isEmpty()) {
            redisTemplate.delete(tokens.stream().map(this::key).toList());
        }

        redisTemplate.delete(userKey(userId));
    }

    private String key(String token) {
        return KEY_PREFIX + token;
    }

    private String userKey(Long userId) {
        return USER_KEY_PREFIX + userId;
    }
}
