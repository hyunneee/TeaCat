package com.teacat.server.auth.repository;

import com.teacat.server.auth.client.OauthProfile;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.Optional;

/**
 * 가입 대기 중인 SSAFY 프로필 저장소 (Redis).
 *
 * SSAFY 인증은 끝났지만 닉네임·전화번호를 아직 받지 못한 상태를 잠깐 들고 있는다.
 * 회원을 미리 만들어 두고 나중에 채우는 방식은 "이름 없는 유령 회원"을 남기므로 쓰지 않는다.
 */
@Repository
@RequiredArgsConstructor
public class OauthSignupTicketRepository {

    private static final String KEY_PREFIX = "oauth:signup:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public void save(String ticket, OauthProfile profile, Duration ttl) {
        redisTemplate.opsForValue().set(key(ticket), objectMapper.writeValueAsString(profile), ttl);
    }

    public Optional<OauthProfile> find(String ticket) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(key(ticket)))
                .map(json -> objectMapper.readValue(json, OauthProfile.class));
    }

    public void delete(String ticket) {
        redisTemplate.delete(key(ticket));
    }

    private String key(String ticket) {
        return KEY_PREFIX + ticket;
    }
}
