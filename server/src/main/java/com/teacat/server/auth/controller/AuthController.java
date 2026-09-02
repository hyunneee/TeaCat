package com.teacat.server.auth.controller;

import com.teacat.server.auth.dto.request.LoginRequest;
import com.teacat.server.auth.dto.request.SignupRequest;
import com.teacat.server.auth.dto.response.LoginResponse;
import com.teacat.server.auth.dto.response.SignupResponse;
import com.teacat.server.auth.service.AuthService;
import com.teacat.server.common.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "인증", description = "회원가입 · 로그인 API")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "회원가입", description = "회원 생성과 1,500 CAT 지급을 한 트랜잭션으로 처리합니다. (CAT 지급은 지갑 API 연동 후 추가)")
    @PostMapping("/signup")
    public ResponseEntity<BaseResponse<SignupResponse>> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("회원가입이 완료되었습니다.", authService.signup(request)));
    }

    @Operation(summary = "로그인", description = "이메일과 비밀번호로 액세스 토큰을 발급받습니다.")
    @PostMapping("/login")
    public ResponseEntity<BaseResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(BaseResponse.success(authService.login(request)));
    }
}
