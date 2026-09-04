package com.teacat.server.payment.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum PaymentErrorCode implements ErrorCode {

    /** 토스 시크릿 키가 설정되지 않았다. 나머지 기능은 그대로 동작한다 */
    PAYMENT_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENT_001",
            "결제 서비스가 아직 준비되지 않았습니다."),
    PAYMENT_AMOUNT_OUT_OF_RANGE(HttpStatus.BAD_REQUEST, "PAYMENT_002",
            "충전 가능한 금액 범위를 벗어났습니다."),
    PAYMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "PAYMENT_003",
            "결제 정보를 찾을 수 없습니다."),
    PAYMENT_OWNER_MISMATCH(HttpStatus.FORBIDDEN, "PAYMENT_004",
            "본인의 결제가 아닙니다."),
    /** 프론트가 보낸 금액이 서버가 확정한 금액과 다르다. 위조 시도일 수 있다 */
    PAYMENT_AMOUNT_MISMATCH(HttpStatus.BAD_REQUEST, "PAYMENT_005",
            "결제 금액이 일치하지 않습니다."),
    /** 이미 승인됐거나 승인이 진행 중이다 */
    PAYMENT_ALREADY_PROCESSED(HttpStatus.CONFLICT, "PAYMENT_006",
            "이미 처리 중이거나 처리된 결제입니다."),
    /** 토스가 승인을 거절했다. 사유는 payments.failure_code 에 남는다 */
    PAYMENT_APPROVAL_FAILED(HttpStatus.BAD_REQUEST, "PAYMENT_007",
            "결제 승인에 실패했습니다."),
    TOKEN_CHARGE_NOT_FOUND(HttpStatus.NOT_FOUND, "PAYMENT_008",
            "충전 내역을 찾을 수 없습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
