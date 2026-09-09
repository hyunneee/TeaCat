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
            "충전 내역을 찾을 수 없습니다."),

    /** 구역에 가격이 설정되지 않았다. 운영 데이터 문제라 사용자가 할 수 있는 일이 없다 */
    AREA_PRICE_NOT_SET(HttpStatus.CONFLICT, "PAYMENT_009",
            "이 구역의 가격이 아직 설정되지 않았습니다."),
    /** 1인 최대 매수 초과 (booking.policy.max-tickets-per-user) */
    TICKET_LIMIT_EXCEEDED(HttpStatus.CONFLICT, "PAYMENT_010",
            "이 회차에서 구매할 수 있는 매수를 초과했습니다."),
    TICKET_ORDER_NOT_FOUND(HttpStatus.NOT_FOUND, "PAYMENT_011",
            "주문 정보를 찾을 수 없습니다."),
    /**
     * 승인 직전/직후에 좌석 선점을 잃었다.
     *
     * 승인 전이면 그냥 거절이지만, 승인 후라면 돈은 빠졌는데 좌석이 없는 상태다.
     * 그때는 사람이 봐야 하므로 로그를 크게 남긴다.
     */
    SEAT_NO_LONGER_HELD(HttpStatus.CONFLICT, "PAYMENT_012",
            "좌석 선점이 유지되지 않아 발권할 수 없습니다. 좌석을 다시 선택해 주세요."),

    /**
     * 카드 취소 요청이 실패했다.
     *
     * 예매는 이미 무효화된 뒤라 사용자에게 "취소 실패" 로 보여선 안 된다.
     * 부르는 쪽이 잡아서 재시도에 맡긴다 — 멱등 키가 있어 두 번 취소되지 않는다.
     */
    PAYMENT_CANCEL_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENT_013",
            "결제 취소에 실패했습니다. 잠시 후 다시 시도해 주세요."),
    /** 공연이 시작된 뒤에는 취소할 수 없다 (예매 정책) */
    CANCEL_DEADLINE_PASSED(HttpStatus.CONFLICT, "PAYMENT_014",
            "공연이 시작되어 취소할 수 없습니다."),
    /** 이미 취소된 예매 */
    ALREADY_CANCELED(HttpStatus.CONFLICT, "PAYMENT_015",
            "이미 취소된 예매입니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
