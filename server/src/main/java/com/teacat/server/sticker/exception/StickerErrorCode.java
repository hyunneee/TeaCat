package com.teacat.server.sticker.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * AI 스티커 에러 코드.
 *
 * <p>🔴 <b>주제 길이 초과에는 코드가 없다.</b> 규칙 3-3 대로 DTO 의 {@code @Size} 가 막고,
 * {@code @Valid} 실패는 {@code BaseResponse.fail(message)} 로 나가 code 필드가 없다.
 * 프론트가 코드로 분기하는 건 {@code STICKER_001} 하나뿐이다.
 *
 * <p>🔴 <b>남의 것은 404 가 아니라 403 이다.</b> 리포의 다른 여덟 도메인이 전부 403 이고,
 * 404 의 근거인 "존재 누출" 은 여기서 막을 게 없다 — id 가 연번이라 자기 id 간격만 봐도
 * 남의 생성량이 추정된다. 새는 건 상태 코드가 아니라 연번 id 이고, 그건 티켓·결제·포토카드가
 * 이미 똑같이 갖고 있다. 스티커만 다르게 답하면 누출은 그대로인데 규칙만 두 개가 된다.
 */
@Getter
@RequiredArgsConstructor
public enum StickerErrorCode implements ErrorCode {

    DAILY_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "STICKER_001", "오늘 만들 수 있는 스티커를 다 썼습니다."),
    INVALID_SKETCH(HttpStatus.BAD_REQUEST, "STICKER_002", "낙서 이미지를 읽을 수 없습니다."),
    SKETCH_TOO_LARGE(HttpStatus.BAD_REQUEST, "STICKER_003", "낙서 이미지가 너무 큽니다."),
    JOB_NOT_FOUND(HttpStatus.NOT_FOUND, "STICKER_004", "존재하지 않는 작업입니다."),
    STICKER_NOT_FOUND(HttpStatus.NOT_FOUND, "STICKER_005", "존재하지 않는 스티커입니다."),
    NOT_OWNED(HttpStatus.FORBIDDEN, "STICKER_006", "본인의 스티커가 아닙니다."),
    INVALID_INTERNAL_KEY(HttpStatus.UNAUTHORIZED, "STICKER_007", "내부 API 키가 올바르지 않습니다."),
    /**
     * 하루 무료 몫을 넘겼는데 캣머니가 모자라다 (2026-09-23).
     *
     * <p>🔴 {@link #DAILY_LIMIT_EXCEEDED} 와 다르다 — 그쪽은 "오늘은 끝" 이고 이쪽은
     * "돈만 있으면 된다" 다. 화면이 보여줄 안내가 완전히 다르므로 코드를 나눈다.
     */
    NOT_ENOUGH_CAT(HttpStatus.PAYMENT_REQUIRED, "STICKER_010", "캣머니가 모자랍니다."),
    INVALID_IDEMPOTENCY_KEY(HttpStatus.BAD_REQUEST, "STICKER_010", "Idempotency-Key 헤더가 올바르지 않습니다."),

    /* ── 워커 전용. 프론트에는 나가지 않는다 ───────────────────────────────── */

    /** 스위퍼가 되돌린 뒤 늦게 도착한 결과. 이미 DONE 인 경우는 에러가 아니라 no-op 이다 */
    JOB_NOT_RUNNING(HttpStatus.CONFLICT, "STICKER_008", "진행 중인 작업이 아닙니다."),
    INVALID_RESULT_IMAGE(HttpStatus.BAD_REQUEST, "STICKER_009", "결과 이미지를 읽을 수 없습니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
