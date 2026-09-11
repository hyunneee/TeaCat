package com.teacat.server.auth.security;

import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.auth.repository.RefreshTokenRepository;
import com.teacat.server.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * 리프레시 토큰 발급/검증.
 *
 * 액세스 토큰과 달리 의미 없는 난수(opaque)다. 서버가 Redis 를 봐야만 유효한지 알 수 있으므로
 * 유출되더라도 지우는 즉시 막을 수 있다.
 */
@Component
@RequiredArgsConstructor
public class RefreshTokenProvider {

    private static final int TOKEN_BYTE_LENGTH = 32;

    private final SecureRandom secureRandom = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtProperties jwtProperties;

    public String issue(Long userId) {
        String token = generate();
        refreshTokenRepository.save(token, userId, jwtProperties.refreshTokenValidity());
        return token;
    }

    public Long resolveUserId(String token) {
        return refreshTokenRepository.findUserId(token)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.INVALID_REFRESH_TOKEN));
    }

    public void revoke(String token) {
        refreshTokenRepository.delete(token);
    }

    /**
     * 한 사용자의 리프레시 토큰을 전부 폐기한다.
     *
     * 비밀번호 변경·탈퇴처럼 "지금 붙어 있는 다른 기기를 끊어야" 하는 경우에 쓴다.
     */
    public void revokeAll(Long userId) {
        refreshTokenRepository.deleteAllByUser(userId);
    }

    private String generate() {
        byte[] bytes = new byte[TOKEN_BYTE_LENGTH];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
