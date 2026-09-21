package com.teacat.server.resale.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ResaleErrorCode implements ErrorCode {

    ENTRY_NOT_FOUND(HttpStatus.NOT_FOUND, "ERR_RESALE_001", "대기 신청 내역을 찾을 수 없습니다."),
    SECTION_NOT_FOUND(HttpStatus.NOT_FOUND, "ERR_RESALE_002", "이 회차에서 판매하는 구역이 아닙니다."),
    /** 남은 자리가 있는 구역은 대기가 아니라 예매를 해야 한다 */
    SECTION_NOT_SOLD_OUT(HttpStatus.CONFLICT, "ERR_RESALE_003", "잔여 좌석이 있는 구역은 대기를 신청할 수 없습니다. 바로 예매해 주세요."),
    ALREADY_WAITING(HttpStatus.CONFLICT, "ERR_RESALE_004", "이미 이 구역에 대기를 신청했습니다."),
    /** 취소 마감이 지나면 취소표가 나올 수 없으므로 대기도 의미가 없다 */
    WAITLIST_CLOSED(HttpStatus.CONFLICT, "ERR_RESALE_005", "예매 취소 마감이 지나 대기를 신청할 수 없습니다."),
    TICKET_LIMIT_EXCEEDED(HttpStatus.CONFLICT, "ERR_RESALE_006", "이 회차의 예매 가능 매수를 이미 채웠습니다."),
    QUANTITY_EXCEEDED(HttpStatus.BAD_REQUEST, "ERR_RESALE_007", "1인 최대 신청 매수를 넘었습니다."),
    /** 대기 중이거나 당첨 상태만 접을 수 있다 */
    ENTRY_NOT_CANCELABLE(HttpStatus.CONFLICT, "ERR_RESALE_008", "이미 종료된 대기 신청입니다."),
    DRAW_NOT_FOUND(HttpStatus.NOT_FOUND, "ERR_RESALE_009", "추첨을 찾을 수 없습니다."),
    /** 블록체인 서비스가 추첨 요청을 거절했거나 응답하지 않았다. 스위퍼가 다시 시도한다 */
    DRAW_CHAIN_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "ERR_RESALE_010", "추첨 서비스에 연결할 수 없습니다. 잠시 후 다시 시도됩니다."),
    TICKETING_NOT_OPEN(HttpStatus.CONFLICT, "ERR_RESALE_011", "예매가 열린 회차에만 대기를 신청할 수 있습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
