package com.teacat.server.gate.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * 현장 검표 에러 코드.
 *
 * <p>🔴 <b>한 번 나간 코드는 바꾸지 않는다</b> (server/CLAUDE.md 3-2). 게이트 화면이 코드로
 * 분기해 색과 안내 문구를 고른다.
 *
 * <p>"안 닮았다"는 여기 없다. 그건 에러가 아니라 <b>정상 응답</b>이고
 * ({@code decision: NO_MATCH}), 예외로 만들면 화면이 실패 처리로 넘겨 운영자가
 * 다시 찍을 기회를 잃는다.
 */
@Getter
@RequiredArgsConstructor
public enum GateErrorCode implements ErrorCode {

    /**
     * 기본 얼굴({@code bootstrap-default})의 모델 버전으로 대조를 요청했다.
     *
     * <p>🔴 <b>이 검사가 없으면 만능 열쇠가 된다.</b> 가입 시 채워 두는 기본 얼굴은 모든 계정이
     * <b>같은 균일 벡터</b>다({@code Face.defaultFace()}). 그 값과 그 모델 버전을 함께 보내면
     * 아직 실제 얼굴을 등록하지 않은 티켓 전부와 유사도 1.0 으로 붙는다 — 아무나
     * 첫 번째 티켓으로 입장하게 된다.
     *
     * <p>정상 클라이언트는 이 값을 보낼 일이 없다. 보냈다면 잘못 짠 것이거나 떠보는 것이다.
     */
    FACE_MODEL_NOT_ALLOWED(HttpStatus.BAD_REQUEST, "GATE_001",
            "기본 얼굴로는 본인 확인을 할 수 없습니다."),

    /** 이미 입장한 티켓. 되돌리려면 입장 기록을 취소한다 */
    ALREADY_ADMITTED(HttpStatus.CONFLICT, "GATE_002",
            "이미 입장 처리된 티켓입니다."),

    /** 취소된 예매다. 얼굴이 맞아도 들여보내지 않는다 */
    TICKET_NOT_ADMITTABLE(HttpStatus.CONFLICT, "GATE_003",
            "입장할 수 없는 티켓입니다. 취소된 예매입니다."),

    /** 되돌릴 입장 기록이 없다 */
    ADMISSION_NOT_FOUND(HttpStatus.NOT_FOUND, "GATE_004",
            "입장 기록이 없습니다."),

    /**
     * 임베딩의 차원이 128 이 아니다.
     *
     * <p>배열 하나하나의 길이는 Bean Validation 으로 걸 수 없어({@code List<float[]>} 의
     * 원소 길이) 서비스에서 본다. 여기서 막지 않으면 pgvector 가 SQL 단에서 터지고,
     * 그 에러 메시지에는 <b>임베딩 값이 그대로 실린다</b> — 그게 로그로, 이어서 Sentry 로 나간다.
     */
    INVALID_EMBEDDING(HttpStatus.BAD_REQUEST, "GATE_005",
            "얼굴 특징값은 128 차원이어야 합니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
