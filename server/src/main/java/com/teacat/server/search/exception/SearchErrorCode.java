package com.teacat.server.search.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum SearchErrorCode implements ErrorCode {
    INVALID_SESSION(HttpStatus.BAD_REQUEST, "SEARCH_001", "올바르지 않은 검색 세션입니다."),
    INVALID_KEYWORD(HttpStatus.BAD_REQUEST, "SEARCH_002", "검색어를 입력해 주세요.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
