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
    ALREADY_CLAIMED(HttpStatus.CONFLICT, "ERR_REWARD_001", "오늘은 이미 받았습니다. 내일 다시 도전해 주세요.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
