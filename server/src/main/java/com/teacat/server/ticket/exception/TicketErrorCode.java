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
            "NFT 티켓을 소각하지 못했습니다. 잠시 후 다시 시도해 주세요."),

    /* ── 입장 확인 (게이트 검표) ────────────────────────────── */

    /**
     * QR 이 우리가 만든 것이 아니다 (서명 불일치 · 형식 오류).
     *
     * 🔴 "없는 티켓" 과 <b>구분해서 알려주지 않는다.</b> 어느 쪽인지 알려주면
     * 티켓 번호를 하나씩 넣어보며 존재하는 번호를 찾아낼 수 있다.
     */
    TICKET_QR_INVALID(HttpStatus.BAD_REQUEST, "TICKET_005", "티켓을 확인할 수 없는 QR 입니다."),

    TICKET_WRONG_PERFORMANCE(HttpStatus.BAD_REQUEST, "TICKET_006", "이 회차의 티켓이 아닙니다."),
    TICKET_CANCELLED(HttpStatus.BAD_REQUEST, "TICKET_007", "취소된 티켓입니다."),
    TICKET_ALREADY_CHECKED_IN(HttpStatus.CONFLICT, "TICKET_008", "이미 입장한 티켓입니다."),

    /**
     * 예매 당시 얼굴이 없거나 기본 얼굴이라 대조가 성립하지 않는다.
     * "확인할 수 없음" 으로 끝나지, 통과시키지 않는다.
     */
    TICKET_FACE_UNAVAILABLE(HttpStatus.BAD_REQUEST, "TICKET_009",
            "이 티켓에는 대조할 얼굴이 없습니다."),
    TICKET_FACE_MODEL_MISMATCH(HttpStatus.BAD_REQUEST, "TICKET_010",
            "얼굴 인식 모델이 달라 대조할 수 없습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
