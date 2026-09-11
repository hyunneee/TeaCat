package com.teacat.server.booking.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum BookingErrorCode implements ErrorCode {

    PERFORMANCE_DETAIL_NOT_FOUND(HttpStatus.NOT_FOUND, "ERR_BOOKING_001",
            "존재하지 않는 공연 회차입니다."),
    SEAT_NOT_FOUND(HttpStatus.NOT_FOUND, "ERR_BOOKING_002",
            "해당 회차에 존재하지 않는 좌석입니다."),
    TICKETING_NOT_AVAILABLE(HttpStatus.CONFLICT, "ERR_BOOKING_003",
            "예매 가능한 시간이 아닙니다."),
    SEAT_ALREADY_HELD(HttpStatus.CONFLICT, "ERR_BOOKING_004",
            "다른 사용자가 선점한 좌석입니다."),
    SEAT_ALREADY_SOLD(HttpStatus.CONFLICT, "ERR_BOOKING_005",
            "이미 판매된 좌석입니다."),
    SEAT_HOLD_LIMIT_EXCEEDED(HttpStatus.CONFLICT, "ERR_BOOKING_006",
            "이미 선점한 좌석이 있습니다. 기존 좌석을 해제한 후 다시 선택해주세요."),
    SEAT_HOLD_NOT_FOUND(HttpStatus.NOT_FOUND, "ERR_BOOKING_007",
            "선점한 좌석이 없습니다."),
    NOT_SEAT_HOLDER(HttpStatus.FORBIDDEN, "ERR_BOOKING_008",
            "본인이 선점한 좌석이 아닙니다."),
    SEAT_HOLD_EXPIRED(HttpStatus.CONFLICT, "ERR_BOOKING_009",
            "좌석 선점 시간이 만료되었습니다. 좌석을 다시 선택해주세요."),
    SEAT_ALREADY_HELD_BY_ME(HttpStatus.CONFLICT, "ERR_BOOKING_010",
            "이미 선점한 좌석입니다. 선점 시간은 연장할 수 없습니다."),

    /**
     * 얼굴 미등록. 선점 단계에서 막는다.
     *
     * 티켓은 얼굴 없이 발급될 수 없다({@code tickets.face_id} 가 NOT NULL). 결제까지 받은 뒤
     * 발급에서 막히면 "돈은 나갔는데 티켓이 없는" 상태가 되므로, 좌석을 묶기 전에 거절한다.
     * 남의 좌석을 10분간 묶어두는 행위이기도 하다.
     */
    FACE_NOT_REGISTERED(HttpStatus.FORBIDDEN, "ERR_BOOKING_011",
            "얼굴 정보를 먼저 등록해 주세요.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
