package com.teacat.server.reward.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum RewardErrorCode implements ErrorCode {

    /**
     * 오늘 이미 받았다.
     *
     * <p>🔴 <b>코드 문자열을 바꾸지 마세요.</b> 프론트가 이 코드로 "오늘 게임을 이미 성공했어요"
     * 화면을 띄웁니다 (server/CLAUDE.md 3-2 — 한 번 나간 코드는 바꾸지 않는다).
     */
    ALREADY_CLAIMED(HttpStatus.CONFLICT, "ERR_REWARD_001", "오늘은 이미 받았습니다. 내일 다시 도전해 주세요."),

    /** 사용자가 누를 수 없는 보상이다 (짝 맞추기 1등처럼 서버가 조건을 보고 넣는 것) */
    NOT_CLAIMABLE(HttpStatus.BAD_REQUEST, "ERR_REWARD_002", "직접 받을 수 있는 보상이 아닙니다."),

    /** 시작하지 않은 판을 끝냈다고 보냈거나, 남의 판이다 */
    GAME_SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "ERR_REWARD_003", "진행 중인 게임을 찾을 수 없습니다."),

    /** 이미 끝난 판을 다시 끝냈다고 보냈다 */
    GAME_ALREADY_CLEARED(HttpStatus.CONFLICT, "ERR_REWARD_004", "이미 끝난 게임입니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
