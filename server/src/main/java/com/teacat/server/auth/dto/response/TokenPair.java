package com.teacat.server.auth.dto.response;

/**
 * 서비스가 발급한 토큰 한 쌍을 컨트롤러로 넘기는 내부 전달용 타입.
 *
 * 액세스 토큰은 응답 바디({@link TokenResponse})로, 리프레시 토큰은 httpOnly 쿠키로
 * 서로 다른 경로로 나가기 때문에 둘을 함께 들고 나온다. 이 타입 자체는 직렬화되지 않는다.
 */
public record TokenPair(String accessToken, long accessTokenExpiresIn, String refreshToken) {
}
