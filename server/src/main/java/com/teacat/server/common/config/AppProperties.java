package com.teacat.server.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yaml 의 app.* 설정.
 *
 * @param frontendBaseUrl    외부 로그인을 마치고 사용자를 돌려보낼 프론트 주소
 * @param oauthRedirectPath  프론트에서 결과를 처리하는 화면 경로
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(String frontendBaseUrl, String oauthRedirectPath) {

    public String oauthRedirectUrl() {
        return frontendBaseUrl + oauthRedirectPath;
    }
}
