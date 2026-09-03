package com.teacat.server.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 로그인 · 토큰 재발급 응답.
 *
 * 리프레시 토큰은 여기 담지 않는다. httpOnly 쿠키로만 나간다(JS 가 읽을 수 없어야 한다).
 */
@Schema(description = "액세스 토큰 응답")
public record TokenResponse(

        @Schema(description = "액세스 토큰")
        String accessToken,

        @Schema(description = "토큰 타입", example = "Bearer")
        String tokenType,

        @Schema(description = "액세스 토큰 만료까지 남은 시간(초)", example = "3600")
        Long expiresIn
) {

    private static final String TOKEN_TYPE_BEARER = "Bearer";

    public static TokenResponse of(String accessToken, long expiresIn) {
        return new TokenResponse(accessToken, TOKEN_TYPE_BEARER, expiresIn);
    }
}
