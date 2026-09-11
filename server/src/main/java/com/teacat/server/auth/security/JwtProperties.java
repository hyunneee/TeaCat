package com.teacat.server.auth.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 jwt.* 설정.
 *
 * secret 은 HS256 서명에 쓰이므로 최소 32 바이트 이상이어야 하며, 운영 환경에서는 JWT_SECRET 으로 주입한다.
 */
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String secret,
        Duration accessTokenValidity,
        Duration refreshTokenValidity,
        RefreshCookie refreshCookie
) {

    /**
     * 리프레시 토큰 쿠키 설정.
     *
     * 개발은 vite 프록시를 타서 같은 사이트라 Lax 로 충분하지만,
     * 운영처럼 프론트와 API 의 도메인이 다르면 반드시 sameSite=None + secure=true 여야 한다.
     */
    public record RefreshCookie(boolean secure, String sameSite, String path) {
    }
}
