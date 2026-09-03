package com.teacat.server.auth.client;

/**
 * SSAFY 토큰 응답 중 우리가 쓰는 것만.
 *
 * refresh_token 도 함께 오지만 쓰지 않는다 — 우리 서비스의 세션은 우리가 발급한
 * 리프레시 토큰으로 유지하고, SSAFY 토큰은 사용자 정보를 한 번 읽는 데만 쓴다.
 */
public record SsafyToken(String tokenType, String accessToken) {

    private static final String DEFAULT_TOKEN_TYPE = "Bearer";

    public String authorizationHeader() {
        String type = (tokenType == null || tokenType.isBlank()) ? DEFAULT_TOKEN_TYPE : tokenType;
        return type + " " + accessToken;
    }
}
