package com.teacat.server.auth.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum AuthErrorCode implements ErrorCode {

    LOGIN_FAILED(HttpStatus.UNAUTHORIZED, "AUTH_001", "이메일 또는 비밀번호가 올바르지 않습니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "AUTH_002", "인증이 필요합니다."),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_003", "유효하지 않은 토큰입니다."),
    EXPIRED_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_004", "만료된 토큰입니다."),
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "AUTH_005", "접근 권한이 없습니다."),
    REFRESH_TOKEN_REQUIRED(HttpStatus.UNAUTHORIZED, "AUTH_006", "로그인이 필요합니다."),
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_007", "로그인이 만료되었습니다. 다시 로그인해 주세요."),
    OAUTH_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "AUTH_008", "SSAFY 로그인이 아직 준비되지 않았습니다."),
    OAUTH_STATE_INVALID(HttpStatus.BAD_REQUEST, "AUTH_009", "잘못된 접근입니다. 처음부터 다시 시도해 주세요."),
    OAUTH_EXCHANGE_FAILED(HttpStatus.BAD_GATEWAY, "AUTH_010", "SSAFY 계정 정보를 가져오지 못했습니다."),
    OAUTH_SIGNUP_EXPIRED(HttpStatus.UNAUTHORIZED, "AUTH_011", "가입 시간이 만료되었습니다. 다시 시도해 주세요."),
    OAUTH_EMAIL_REQUIRED(HttpStatus.BAD_REQUEST, "AUTH_012", "SSAFY 계정에 이메일이 없어 가입할 수 없습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
