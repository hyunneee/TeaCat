package com.teacat.server.ticket.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum TicketErrorCode implements ErrorCode {

    TICKET_NOT_FOUND(HttpStatus.NOT_FOUND, "TICKET_001", "존재하지 않는 티켓입니다."),
    TICKET_NOT_OWNED(HttpStatus.FORBIDDEN, "TICKET_002", "본인의 티켓이 아닙니다."),

    /**
     * NFT 발행 요청이 나가지 못했다.
     *
     * 결제와 발권은 이미 끝난 뒤라 사용자에게 실패로 보여선 안 된다. 부르는 쪽이 잡아서
     * 재시도에 맡긴다 — 같은 ticketKey 로 다시 보내도 두 장이 발행되지 않는다.
     */
    TICKET_ISSUE_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "TICKET_003",
            "NFT 티켓을 발행하지 못했습니다. 잠시 후 다시 시도해 주세요."),

    /**
     * NFT 소각 요청이 나가지 못했다.
     *
     * 예매 취소와 환불은 이미 진행된 뒤라 사용자에게 실패로 보여선 안 된다.
     * 재시도에 맡긴다 — 이미 소각된 티켓이면 ALREADY_DONE 이라 두 번 태우지 않는다.
     */
    TICKET_BURN_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "TICKET_004",
            "NFT 티켓을 소각하지 못했습니다. 잠시 후 다시 시도해 주세요.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
