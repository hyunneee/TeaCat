package com.teacat.server.auth.security;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * 인증 과정에서 브라우저에 심는 쿠키를 만든다.
 *
 * 전부 httpOnly 라서 JS 가 읽을 수 없고(XSS 로 탈취 불가), path 를 좁혀 두어
 * 일반 API 요청에는 아예 실려 나가지 않는다.
 */
@Component
@RequiredArgsConstructor
public class AuthCookieFactory {

    public static final String REFRESH_TOKEN_COOKIE = "refreshToken";

    /** SSAFY 인증은 끝났지만 아직 가입이 안 끝난 사람을 잠깐 알아보기 위한 쿠키 */
    public static final String SIGNUP_TICKET_COOKIE = "oauthSignupTicket";

    private final JwtProperties jwtProperties;

    public ResponseCookie refreshToken(String refreshToken) {
        return builder(REFRESH_TOKEN_COOKIE, refreshToken)
                .maxAge(jwtProperties.refreshTokenValidity())
                .build();
    }

    /** 로그아웃 시 브라우저에 남은 쿠키를 지운다. */
    public ResponseCookie expiredRefreshToken() {
        return builder(REFRESH_TOKEN_COOKIE, "")
                .maxAge(Duration.ZERO)
                .build();
    }

    public ResponseCookie signupTicket(String ticket, Duration validity) {
        return builder(SIGNUP_TICKET_COOKIE, ticket)
                .maxAge(validity)
                .build();
    }

    /** 가입이 끝났거나 실패했으면 티켓은 즉시 지운다. */
    public ResponseCookie expiredSignupTicket() {
        return builder(SIGNUP_TICKET_COOKIE, "")
                .maxAge(Duration.ZERO)
                .build();
    }

    private ResponseCookie.ResponseCookieBuilder builder(String name, String value) {
        JwtProperties.RefreshCookie cookie = jwtProperties.refreshCookie();

        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(cookie.secure())
                .sameSite(cookie.sameSite())
                .path(cookie.path());
    }
}
