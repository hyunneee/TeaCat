package com.teacat.server.user.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum UserErrorCode implements ErrorCode {

    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_001", "존재하지 않는 회원입니다."),
    DUPLICATE_EMAIL(HttpStatus.CONFLICT, "USER_002", "이미 사용 중인 이메일입니다."),
    DUPLICATE_NICKNAME(HttpStatus.CONFLICT, "USER_003", "이미 사용 중인 닉네임입니다."),
    PASSWORD_MISMATCH(HttpStatus.BAD_REQUEST, "USER_004", "현재 비밀번호가 올바르지 않습니다."),
    SAME_PASSWORD(HttpStatus.BAD_REQUEST, "USER_005", "현재 비밀번호와 다른 비밀번호를 입력해 주세요."),
    SAME_NICKNAME(HttpStatus.BAD_REQUEST, "USER_006", "현재 닉네임과 다른 닉네임을 입력해 주세요."),
    FACE_ALREADY_REGISTERED(HttpStatus.CONFLICT, "USER_007", "이미 등록된 얼굴 정보가 있습니다."),
    FACE_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_008", "등록된 얼굴 정보가 없습니다."),
    INVALID_FACE_EMBEDDING(HttpStatus.BAD_REQUEST, "USER_009", "얼굴 특징값 형식이 올바르지 않습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
