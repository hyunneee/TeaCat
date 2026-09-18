package com.teacat.server.queue.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * 가상 대기실 오류 코드.
 *
 * <p>{@code NOT_ADMITTED} 는 428 이다. 401(인증)·403(권한)과 뜻이 다르고, 프론트가
 * "조건을 먼저 채워라 → 대기실로" 로 분기하기 쉽다. 429 는 rate limit 과 헷갈려 피했다.
 */
@Getter
@RequiredArgsConstructor
public enum QueueErrorCode implements ErrorCode {
    SCHEDULE_NOT_FOUND(HttpStatus.NOT_FOUND, "ERR_QUEUE_001",
            "존재하지 않는 공연 회차입니다."),
    NOT_ADMITTED(HttpStatus.PRECONDITION_REQUIRED, "ERR_QUEUE_002",
            "대기실을 거쳐 입장해야 합니다. 순서를 기다려 주세요."),
    QUEUE_DISABLED(HttpStatus.CONFLICT, "ERR_QUEUE_003",
            "이 회차는 대기실을 운영하지 않습니다."),
    INVALID_CONFIG(HttpStatus.BAD_REQUEST, "ERR_QUEUE_004",
            "대기실 설정 값이 올바르지 않습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
