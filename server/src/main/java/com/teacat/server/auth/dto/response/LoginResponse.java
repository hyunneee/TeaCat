package com.teacat.server.auth.dto.response;

import com.teacat.server.user.dto.response.MyInfoResponse;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 로그인 응답.
 *
 * 로그인 직후 화면을 그리려면 내 정보가 필요해서 토큰과 함께 내려준다
 * (프론트가 로그인 → 내 정보 조회로 두 번 왕복하지 않도록).
 * 리프레시 토큰은 여기 담지 않는다. httpOnly 쿠키로만 나간다.
 */
@Schema(description = "로그인 응답")
public record LoginResponse(

        @Schema(description = "액세스 토큰")
        String accessToken,

        @Schema(description = "토큰 타입", example = "Bearer")
        String tokenType,

        @Schema(description = "액세스 토큰 만료까지 남은 시간(초)", example = "3600")
        Long expiresIn,

        @Schema(description = "로그인한 회원 정보")
        MyInfoResponse user
) {

    public static LoginResponse of(TokenPair tokens, MyInfoResponse user) {
        TokenResponse token = TokenResponse.of(tokens.accessToken(), tokens.accessTokenExpiresIn());

        return new LoginResponse(token.accessToken(), token.tokenType(), token.expiresIn(), user);
    }
}
