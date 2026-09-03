package com.teacat.server.auth.client;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yaml 의 oauth.ssafy.* 설정.
 *
 * client-secret 은 코드·설정 파일에 적지 않는다. 환경변수(SSAFY_CLIENT_SECRET)로만 주입한다.
 *
 * @param redirectUri 제공자에 등록한 콜백 주소. 우리 서버의 /api/auth/oauth/ssafy/callback 을 가리켜야 한다
 */
@ConfigurationProperties(prefix = "oauth.ssafy")
public record SsafyOauthProperties(
        String clientId,
        String clientSecret,
        String redirectUri,
        String authorizationUri,
        String tokenUri,
        String userInfoUri,
        String scope
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
