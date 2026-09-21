package com.teacat.server.auth.controller;

import com.teacat.server.auth.dto.request.OauthSignupRequest;
import com.teacat.server.auth.dto.response.AuthorizationRedirect;
import com.teacat.server.auth.dto.response.LoginResponse;
import com.teacat.server.auth.dto.response.LoginResult;
import com.teacat.server.auth.dto.response.OauthCallbackResult;
import com.teacat.server.auth.dto.response.PendingSignupResponse;
import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.auth.security.AuthCookieFactory;
import com.teacat.server.auth.security.ClientRequest;
import jakarta.servlet.http.HttpServletRequest;
import com.teacat.server.auth.service.OauthService;
import com.teacat.server.common.config.AppProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

/**
 * SSAFY 계정 로그인.
 *
 * authorize/callback 은 브라우저가 직접 오가는 **페이지 이동**이라 JSON 을 내려주지 않는다.
 * 실패해도 JSON 을 보여줄 수 없으므로 결과를 쿼리 파라미터에 담아 프론트로 돌려보낸다.
 */
@Slf4j
@Tag(name = "SSAFY 로그인", description = "SSAFY 계정 연동 로그인 · 가입 API")
@RestController
@RequestMapping("/auth/oauth/ssafy")
@RequiredArgsConstructor
public class OauthController {

    private static final String STATUS_PARAM = "status";
    private static final String CODE_PARAM = "code";
    private static final String STATUS_SUCCESS = "success";
    private static final String STATUS_SIGNUP = "signup";
    private static final String STATUS_ERROR = "error";

    private final OauthService oauthService;
    private final AuthCookieFactory authCookieFactory;
    private final AppProperties appProperties;

    @Operation(summary = "SSAFY 로그인 시작", description = "SSAFY 로그인 화면으로 이동시킵니다. 버튼에서 페이지 이동으로 호출하세요.")
    @GetMapping("/authorize")
    public ResponseEntity<Void> authorize() {
        try {
            AuthorizationRedirect redirect = oauthService.buildAuthorizationRedirect();

            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(redirect.uri()))
                    .header(HttpHeaders.SET_COOKIE, authCookieFactory
                            .oauthState(redirect.state(), oauthService.getStateValidity())
                            .toString())
                    .build();
        } catch (BusinessException e) {
            // 브라우저가 직접 오는 주소라 JSON 을 보여줄 수 없다. 프론트가 안내하도록 돌려보낸다
            return redirectToFrontend(STATUS_ERROR, e.getErrorCode().getCode()).build();
        }
    }

    @Operation(
            summary = "SSAFY 콜백",
            description = "SSAFY 가 호출하는 주소입니다. 처리 결과를 담아 프론트 화면으로 다시 이동시킵니다."
    )
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @Parameter(description = "SSAFY 가 실패를 알릴 때 붙여 보내는 값")
            @RequestParam(required = false) String error,
            @Parameter(hidden = true)
            @CookieValue(name = AuthCookieFactory.OAUTH_STATE_COOKIE, required = false) String stateCookie,
            @Parameter(hidden = true) HttpServletRequest http) {
        if (StringUtils.hasText(error)) {
            log.warn("SSAFY 인가 거부: {}", error);
            return withExpiredState(redirectToFrontend(STATUS_ERROR, AuthErrorCode.OAUTH_STATE_INVALID.getCode()))
                    .build();
        }

        try {
            // 콜백에 실려 오는 state 는 SSAFY 가 자기 흐름을 위해 만든 값이라 우리 것이 아니다.
            // 그래서 쿼리가 아니라 우리가 심어 둔 쿠키로만 검증한다.
            OauthCallbackResult result = oauthService.handleCallback(code, stateCookie, ClientRequest.from(http));

            if (result.needsSignup()) {
                // 가입이 끝날 때까지만 쓰는 티켓. 주소창에 남지 않도록 쿠키로 넘긴다
                return withExpiredState(redirectToFrontend(STATUS_SIGNUP, null))
                        .header(HttpHeaders.SET_COOKIE, authCookieFactory
                                .signupTicket(result.signupTicket(), oauthService.getSignupTicketValidity())
                                .toString())
                        .build();
            }

            // 액세스 토큰은 주소에 싣지 않는다. 프론트가 곧바로 재발급을 호출해 받아 간다
            return withExpiredState(redirectToFrontend(STATUS_SUCCESS, null))
                    .header(HttpHeaders.SET_COOKIE,
                            authCookieFactory.refreshToken(result.tokens().refreshToken()).toString())
                    .build();
        } catch (BusinessException e) {
            return withExpiredState(redirectToFrontend(STATUS_ERROR, e.getErrorCode().getCode())).build();
        }
    }

    /** state 는 콜백 한 번으로 수명이 끝난다 */
    private ResponseEntity.BodyBuilder withExpiredState(ResponseEntity.BodyBuilder builder) {
        return builder.header(HttpHeaders.SET_COOKIE, authCookieFactory.expiredOauthState().toString());
    }

    @Operation(summary = "가입 대기 정보 조회", description = "추가정보 입력 화면이 SSAFY 가 알려준 이메일·이름을 미리 채울 때 씁니다.")
    @GetMapping("/pending")
    public ResponseEntity<BaseResponse<PendingSignupResponse>> pending(
            @Parameter(hidden = true)
            @CookieValue(name = AuthCookieFactory.SIGNUP_TICKET_COOKIE, required = false) String ticket) {
        return ResponseEntity.ok(BaseResponse.success(oauthService.getPendingSignup(ticket)));
    }

    @Operation(summary = "SSAFY 회원가입 완료", description = "닉네임·전화번호를 받아 회원을 만들고 곧바로 로그인시킵니다.")
    @PostMapping("/signup")
    public ResponseEntity<BaseResponse<LoginResponse>> signup(
            @Parameter(hidden = true)
            @CookieValue(name = AuthCookieFactory.SIGNUP_TICKET_COOKIE, required = false) String ticket,
            @Valid @RequestBody OauthSignupRequest request) {
        LoginResult result = oauthService.completeSignup(ticket, request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE,
                        authCookieFactory.refreshToken(result.tokens().refreshToken()).toString())
                .header(HttpHeaders.SET_COOKIE, authCookieFactory.expiredSignupTicket().toString())
                .body(BaseResponse.success("회원가입이 완료되었습니다.",
                        LoginResponse.of(result.tokens(), result.user())));
    }

    private ResponseEntity.BodyBuilder redirectToFrontend(String status, String errorCode) {
        UriComponentsBuilder builder = UriComponentsBuilder
                .fromUriString(appProperties.oauthRedirectUrl())
                .queryParam(STATUS_PARAM, status);

        if (errorCode != null) {
            builder.queryParam(CODE_PARAM, errorCode);
        }

        return ResponseEntity.status(HttpStatus.FOUND).location(builder.build(true).toUri());
    }
}
