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

import java.util.Map;

/**
 * SSAFY OAuth 제공자와 통신한다. 표준 Authorization Code 흐름을 따른다.
 *
 * 🔴 **여기가 제공자 스펙에 의존하는 유일한 곳입니다.**
 *    주소·클라이언트 정보는 application.yaml(oauth.ssafy.*)에 있고,
 *    응답 필드 이름만 아래 {@link #toProfile} 에서 읽습니다.
 *    SSAFY 문서를 받으면 이 클래스 하나만 고치면 됩니다.
 */
@Slf4j
@Component
public class SsafyOauthClient {

    private static final String RESPONSE_TYPE_CODE = "code";
    private static final String GRANT_TYPE_AUTHORIZATION_CODE = "authorization_code";
    private static final String ACCESS_TOKEN_FIELD = "access_token";
    private static final int CONNECT_TIMEOUT_MILLIS = 3_000;
    private static final int READ_TIMEOUT_MILLIS = 5_000;

    /**
     * 제공자마다 이름이 달라서 후보를 순서대로 찾습니다.
     * TODO(ssafy): 실제 응답 필드가 확정되면 후보 목록을 그 이름 하나로 줄이세요.
     */
    private static final String[] ID_FIELDS = {"userId", "id", "sub", "loginId", "memberId"};
    private static final String[] EMAIL_FIELDS = {"email", "userEmail", "mail"};
    private static final String[] NAME_FIELDS = {"name", "userName", "koreanName", "nickname"};

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

    /** 사용자를 보낼 SSAFY 로그인 주소 */
    public String buildAuthorizationUri(String state) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(properties.authorizationUri())
                .queryParam("response_type", RESPONSE_TYPE_CODE)
                .queryParam("client_id", properties.clientId())
                .queryParam("redirect_uri", properties.redirectUri())
                .queryParam("state", state);

        if (properties.scope() != null && !properties.scope().isBlank()) {
            builder.queryParam("scope", properties.scope());
        }

        return builder.build(true).toUriString();
    }

    /** 인가 코드를 액세스 토큰으로 교환한다. client_secret 은 이 요청에서만 쓰인다 */
    public String exchangeCodeForAccessToken(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", GRANT_TYPE_AUTHORIZATION_CODE);
        form.add("code", code);
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("redirect_uri", properties.redirectUri());

        Map<String, Object> response = post(properties.tokenUri(), form);
        Object accessToken = response.get(ACCESS_TOKEN_FIELD);

        if (accessToken == null) {
            // 토큰 응답 전체를 로그로 남기지 않습니다 — 토큰이 그대로 찍힙니다
            log.error("SSAFY 토큰 응답에 {} 가 없습니다. 응답 키: {}", ACCESS_TOKEN_FIELD, response.keySet());
            throw new BusinessException(AuthErrorCode.OAUTH_EXCHANGE_FAILED);
        }

        return accessToken.toString();
    }

    public OauthProfile fetchProfile(String accessToken) {
        return toProfile(get(properties.userInfoUri(), accessToken));
    }

    private OauthProfile toProfile(Map<String, Object> body) {
        String providerUserId = firstPresent(body, ID_FIELDS);

        if (providerUserId == null) {
            log.error("SSAFY 사용자 정보에서 식별자를 찾지 못했습니다. 응답 키: {}", body.keySet());
            throw new BusinessException(AuthErrorCode.OAUTH_EXCHANGE_FAILED);
        }

        return new OauthProfile(providerUserId, firstPresent(body, EMAIL_FIELDS), firstPresent(body, NAME_FIELDS));
    }

    private String firstPresent(Map<String, Object> body, String[] candidates) {
        for (String candidate : candidates) {
            Object value = body.get(candidate);
            if (value != null && !value.toString().isBlank()) {
                return value.toString();
            }
        }
        return null;
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

    private Map<String, Object> get(String uri, String accessToken) {
        try {
            Map<String, Object> body = restClient.get()
                    .uri(uri)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
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
