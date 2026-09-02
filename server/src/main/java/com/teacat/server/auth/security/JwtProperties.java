package com.teacat.server.auth.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * application.yaml 의 jwt.* 설정.
 *
 * secret 은 HS256 서명에 쓰이므로 최소 32 바이트 이상이어야 하며, 운영 환경에서는 JWT_SECRET 으로 주입한다.
 */
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(String secret, Duration accessTokenValidity) {
}
