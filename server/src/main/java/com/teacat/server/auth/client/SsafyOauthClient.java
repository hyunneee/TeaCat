package com.teacat.server.auth.client;

import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * SSAFY OAuth 제공자와 통신한다. (SSAFY 프로젝트 API 문서 기준)
 *
 *   인가   GET  https://project.ssafy.com/oauth/sso-check
 *   토큰   POST https://project.ssafy.com/ssafy/oauth2/token
 *   정보   GET  https://project.ssafy.com/ssafy/resources/userInfo
 *
 * 주소·클라이언트 정보는 application.yaml(oauth.ssafy.*)에 있다.
 * 제공자 스펙이 바뀌면 이 클래스 하나만 고치면 된다.
 */
@Slf4j
@Component
public class SsafyOauthClient {

    private static final String RESPONSE_TYPE_CODE = "code";
    private static final String GRANT_TYPE_AUTHORIZATION_CODE = "authorization_code";

    private static final String TOKEN_TYPE_FIELD = "token_type";
    private static final String ACCESS_TOKEN_FIELD = "access_token";

    /** 사용자 정보 응답 필드 (userId 고정 제공, email·name 은 필수 동의 항목) */
    private static final String USER_ID_FIELD = "userId";
    private static final String EMAIL_FIELD = "email";
    private static final String NAME_FIELD = "name";

    private static final int CONNECT_TIMEOUT_MILLIS = 3_000;
    private static final int READ_TIMEOUT_MILLIS = 5_000;

    private static final ParameterizedTypeReference<Map<String, Object>> JSON_OBJECT =
            new ParameterizedTypeReference<>() {
            };

    private final SsafyOauthProperties properties;
    private final RestClient restClient;

    public SsafyOauthClient(SsafyOauthProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder().requestFactory(requestFactory()).build();
    }

    /** 외부 서버가 응답하지 않을 때 로그인 스레드가 붙잡히지 않도록 타임아웃을 준다 */
    private static ClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
        factory.setReadTimeout(READ_TIMEOUT_MILLIS);
        return factory;
    }

    /**
     * 사용자를 보낼 SSAFY 로그인 주소.
     *
     * state 는 SSAFY 문서에 없는 값이라 기본으로는 붙이지 않는다(oauth.ssafy.send-state).
     * 붙이든 안 붙이든 서버가 같은 값을 쿠키에 심어 두므로 콜백에서 검증할 수 있다.
     */
    public String buildAuthorizationUri(String state) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(properties.authorizationUri())
                .queryParam("client_id", properties.clientId())
                // redirect_uri 는 값 자체가 URL 이라 퍼센트 인코딩해서 넘긴다(RFC 6749 3.1)
                .queryParam("redirect_uri", URLEncoder.encode(properties.redirectUri(), StandardCharsets.UTF_8))
                .queryParam("response_type", RESPONSE_TYPE_CODE);

        // 문서에 없는 파라미터는 기본으로 붙이지 않는다. SSAFY 가 지원하는 것이 확인되면 설정으로 켠다
        if (properties.sendState()) {
            builder.queryParam("state", state);
        }

        return builder.build(true).toUriString();
    }

    /** 인가 코드를 액세스 토큰으로 교환한다. client_secret 은 이 요청에서만 쓰인다 */
    public SsafyToken exchangeCodeForToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", GRANT_TYPE_AUTHORIZATION_CODE);
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("redirect_uri", properties.redirectUri());
        form.add("code", code);

        Map<String, Object> response = post(properties.tokenUri(), form);
        Object accessToken = response.get(ACCESS_TOKEN_FIELD);

        if (accessToken == null) {
            // 토큰 응답 전체를 로그로 남기지 않습니다 — 토큰이 그대로 찍힙니다
            log.error("SSAFY 토큰 응답에 {} 가 없습니다. 응답 키: {}", ACCESS_TOKEN_FIELD, response.keySet());
            throw new BusinessException(AuthErrorCode.OAUTH_EXCHANGE_FAILED);
        }

        return new SsafyToken(text(response.get(TOKEN_TYPE_FIELD)), accessToken.toString());
    }

    public OauthProfile fetchProfile(SsafyToken token) {
        Map<String, Object> body = get(properties.userInfoUri(), token.authorizationHeader());
        String providerUserId = text(body.get(USER_ID_FIELD));

        if (providerUserId == null) {
            log.error("SSAFY 사용자 정보에 {} 가 없습니다. 응답 키: {}", USER_ID_FIELD, body.keySet());
            throw new BusinessException(AuthErrorCode.OAUTH_EXCHANGE_FAILED);
        }

        return new OauthProfile(providerUserId, text(body.get(EMAIL_FIELD)), text(body.get(NAME_FIELD)));
    }

    private String text(Object value) {
        return value == null || value.toString().isBlank() ? null : value.toString();
    }

    private Map<String, Object> post(String uri, MultiValueMap<String, String> form) {
        try {
            Map<String, Object> body = restClient.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(form)
                    .retrieve()
                    .body(JSON_OBJECT);

            return body == null ? Map.of() : body;
        } catch (RuntimeException e) {
            log.error("SSAFY 토큰 교환 실패", e);
            throw new BusinessException(AuthErrorCode.OAUTH_EXCHANGE_FAILED);
        }
    }

    private Map<String, Object> get(String uri, String authorization) {
        try {
            Map<String, Object> body = restClient.get()
                    .uri(uri)
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(JSON_OBJECT);

            return body == null ? Map.of() : body;
        } catch (RuntimeException e) {
            log.error("SSAFY 사용자 정보 조회 실패", e);
            throw new BusinessException(AuthErrorCode.OAUTH_EXCHANGE_FAILED);
        }
    }
}
