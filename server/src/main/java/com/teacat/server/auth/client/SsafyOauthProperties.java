package com.teacat.server.auth.client;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yaml 의 oauth.ssafy.* 설정.
 *
 * client-secret 은 코드·설정 파일에 적지 않는다. 환경변수(SSAFY_CLIENT_SECRET)로만 주입한다.
 * client-id 는 인가 주소에 그대로 실려 나가는 공개 값이라 기본값으로 둔다.
 *
 * @param redirectUri SSAFY 에 등록한 콜백 주소. 우리 서버의 /api/auth/oauth/ssafy/callback 을 가리켜야 한다
 * @param sendState  인가 주소에 state 를 붙일지. SSAFY 문서에 없는 파라미터라 기본은 끔이다.
 *                   꺼도 CSRF 방어는 유지된다 — 같은 값을 httpOnly 쿠키로 들고 있다가 콜백에서 대조한다
 */
@ConfigurationProperties(prefix = "oauth.ssafy")
public record SsafyOauthProperties(
        String clientId,
        String clientSecret,
        String redirectUri,
        String authorizationUri,
        String tokenUri,
        String userInfoUri,
        boolean sendState
) {

    /** 설정이 비어 있으면 연동을 시도조차 하지 않는다 (500 대신 명확한 안내를 내보내기 위해) */
    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
                && clientSecret != null && !clientSecret.isBlank()
                && authorizationUri != null && !authorizationUri.isBlank()
                && tokenUri != null && !tokenUri.isBlank()
                && userInfoUri != null && !userInfoUri.isBlank();
    }
}
