package com.teacat.server.auth.security;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * 리프레시 토큰 쿠키를 만든다.
 *
 * httpOnly 라서 JS 가 읽을 수 없고(XSS 로 탈취 불가), path 를 좁혀 두어
 * 일반 API 요청에는 아예 실려 나가지 않는다.
 */
@Component
@RequiredArgsConstructor
public class RefreshTokenCookieFactory {

    public static final String COOKIE_NAME = "refreshToken";

    private final JwtProperties jwtProperties;

    public ResponseCookie create(String refreshToken) {
        return builder(refreshToken)
                .maxAge(jwtProperties.refreshTokenValidity())
                .build();
    }

    /** 로그아웃 시 브라우저에 남은 쿠키를 지운다. */
    public ResponseCookie expire() {
        return builder("")
                .maxAge(Duration.ZERO)
                .build();
    }

    private ResponseCookie.ResponseCookieBuilder builder(String value) {
        JwtProperties.RefreshCookie cookie = jwtProperties.refreshCookie();

        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(cookie.secure())
                .sameSite(cookie.sameSite())
                .path(cookie.path());
    }
}
