package com.teacat.server.performance.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum PerformanceErrorCode implements ErrorCode {

    PERFORMANCE_NOT_FOUND(HttpStatus.NOT_FOUND, "PERFORMANCE_001", "존재하지 않는 공연입니다."),
    STADIUM_NOT_FOUND(HttpStatus.NOT_FOUND, "PERFORMANCE_002", "존재하지 않는 공연장입니다."),
    TICKETING_ALREADY_STARTED(HttpStatus.CONFLICT, "PERFORMANCE_003",
            "티켓팅이 시작된 공연은 공연장·티켓팅 시각·노출 시작일을 변경할 수 없습니다."),
    INVALID_VISIBLE_FROM(HttpStatus.BAD_REQUEST, "PERFORMANCE_004",
            "노출 시작일은 티켓팅 시작 시각보다 앞서야 합니다."),
    NOTHING_TO_UPDATE(HttpStatus.BAD_REQUEST, "PERFORMANCE_005", "변경할 내용이 없습니다."),
    SCHEDULE_NOT_FOUND(HttpStatus.NOT_FOUND, "PERFORMANCE_006", "존재하지 않는 회차입니다."),
    DUPLICATE_SCHEDULE_NUM(HttpStatus.CONFLICT, "PERFORMANCE_007", "이미 등록된 회차 번호입니다."),
    INVALID_PERFORMANCE_DATE(HttpStatus.BAD_REQUEST, "PERFORMANCE_008",
            "공연 일자는 티켓팅 시작일 이후여야 합니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
