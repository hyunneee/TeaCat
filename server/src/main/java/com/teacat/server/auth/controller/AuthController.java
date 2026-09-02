package com.teacat.server.auth.controller;

import com.teacat.server.auth.dto.request.LoginRequest;
import com.teacat.server.auth.dto.request.SignupRequest;
import com.teacat.server.auth.dto.response.SignupResponse;
import com.teacat.server.auth.dto.response.TokenPair;
import com.teacat.server.auth.dto.response.TokenResponse;
import com.teacat.server.auth.security.RefreshTokenCookieFactory;
import com.teacat.server.auth.service.AuthService;
import com.teacat.server.common.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "인증", description = "회원가입 · 로그인 · 토큰 재발급 API")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenCookieFactory refreshTokenCookieFactory;

    @Operation(summary = "회원가입", description = "회원 생성과 1,500 CAT 지급을 한 트랜잭션으로 처리합니다. (CAT 지급은 지갑 API 연동 후 추가)")
    @PostMapping("/signup")
    public ResponseEntity<BaseResponse<SignupResponse>> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("회원가입이 완료되었습니다.", authService.signup(request)));
    }

    @Operation(
            summary = "로그인",
            description = "액세스 토큰은 응답 바디로, 리프레시 토큰은 httpOnly 쿠키로 내려갑니다."
    )
    @PostMapping("/login")
    public ResponseEntity<BaseResponse<TokenResponse>> login(@Valid @RequestBody LoginRequest request) {
        return tokenResponse(authService.login(request));
    }

    @Operation(
            summary = "액세스 토큰 재발급",
            description = "리프레시 토큰 쿠키로 새 액세스 토큰을 받습니다. 쓴 리프레시 토큰은 폐기되고 새 쿠키가 함께 내려갑니다."
    )
    @PostMapping("/refresh")
    public ResponseEntity<BaseResponse<TokenResponse>> refresh(
            @Parameter(hidden = true)
            @CookieValue(name = RefreshTokenCookieFactory.COOKIE_NAME, required = false) String refreshToken) {
        return tokenResponse(authService.reissue(refreshToken));
    }

    @Operation(summary = "로그아웃", description = "리프레시 토큰을 폐기하고 쿠키를 지웁니다.")
    @PostMapping("/logout")
    public ResponseEntity<BaseResponse<Void>> logout(
            @Parameter(hidden = true)
            @CookieValue(name = RefreshTokenCookieFactory.COOKIE_NAME, required = false) String refreshToken) {
        authService.logout(refreshToken);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookieFactory.expire().toString())
                .body(BaseResponse.success("로그아웃되었습니다."));
    }

    private ResponseEntity<BaseResponse<TokenResponse>> tokenResponse(TokenPair tokens) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookieFactory.create(tokens.refreshToken()).toString())
                .body(BaseResponse.success(
                        TokenResponse.of(tokens.accessToken(), tokens.accessTokenExpiresIn())));
    }
}
