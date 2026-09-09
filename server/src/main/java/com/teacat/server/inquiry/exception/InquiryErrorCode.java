package com.teacat.server.inquiry.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum InquiryErrorCode implements ErrorCode {

    INQUIRY_NOT_FOUND(HttpStatus.NOT_FOUND, "INQUIRY_001", "존재하지 않는 문의입니다."),
    /** 남의 문의는 보이지도, 고쳐지지도 않는다 */
    INQUIRY_FORBIDDEN(HttpStatus.FORBIDDEN, "INQUIRY_002", "본인이 작성한 문의만 볼 수 있습니다."),
    /** 답변이 달린 글이 사라지면 대화가 끊긴 채로 남는다 */
    INQUIRY_ALREADY_ANSWERED(HttpStatus.CONFLICT, "INQUIRY_003",
            "답변이 등록된 문의는 수정하거나 삭제할 수 없습니다."),
    ANSWER_REQUIRED_BEFORE_RESOLVE(HttpStatus.CONFLICT, "INQUIRY_004",
            "답변을 등록한 뒤에 해결 처리할 수 있습니다."),
    INQUIRY_ALREADY_RESOLVED(HttpStatus.CONFLICT, "INQUIRY_005", "이미 해결 처리된 문의입니다."),
    INQUIRY_NOT_RESOLVED(HttpStatus.CONFLICT, "INQUIRY_006", "해결 처리되지 않은 문의입니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
