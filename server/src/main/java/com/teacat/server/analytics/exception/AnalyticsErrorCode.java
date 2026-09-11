package com.teacat.server.analytics.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum AnalyticsErrorCode implements ErrorCode {

    /** 젠킨스가 보낸 내부 키가 안 맞는다. 사람이 보는 화면이 아니라 메시지를 자세히 쓰지 않는다 */
    INVALID_INTERNAL_KEY(HttpStatus.UNAUTHORIZED, "ANALYTICS_001", "내부 API 키가 올바르지 않습니다."),
    /** 종료일이 시작일보다 앞선다 */
    INVALID_PERIOD(HttpStatus.BAD_REQUEST, "ANALYTICS_002", "조회 기간이 올바르지 않습니다."),
    PERIOD_TOO_LONG(HttpStatus.BAD_REQUEST, "ANALYTICS_003", "조회 기간은 최대 365일입니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
