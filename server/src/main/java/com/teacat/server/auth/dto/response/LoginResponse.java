package com.teacat.server.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "로그인 응답")
public record LoginResponse(

        @Schema(description = "액세스 토큰")
        String accessToken,

        @Schema(description = "토큰 타입", example = "Bearer")
        String tokenType,

        @Schema(description = "액세스 토큰 만료까지 남은 시간(초)", example = "3600")
        Long expiresIn
) {

    private static final String TOKEN_TYPE_BEARER = "Bearer";

    public static LoginResponse of(String accessToken, long expiresIn) {
        return new LoginResponse(accessToken, TOKEN_TYPE_BEARER, expiresIn);
    }
}
