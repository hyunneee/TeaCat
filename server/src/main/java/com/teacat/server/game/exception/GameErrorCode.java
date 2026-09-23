package com.teacat.server.game.exception;

import com.teacat.server.common.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum GameErrorCode implements ErrorCode {

    /** 초대 코드가 틀렸거나, 그 방이 이미 시작·종료됐다. 둘을 구분해 주지 않는다 — 코드 찍어보기를 돕는 셈이 된다 */
    ROOM_NOT_FOUND(HttpStatus.NOT_FOUND, "GAME_001",
            "그런 방이 없습니다. 초대 코드를 다시 확인해 주세요."),
    ROOM_FULL(HttpStatus.CONFLICT, "GAME_002",
            "방이 가득 찼습니다."),
    ROOM_ALREADY_STARTED(HttpStatus.CONFLICT, "GAME_003",
            "이미 시작된 방입니다."),
    ROOM_NOT_PLAYING(HttpStatus.CONFLICT, "GAME_004",
            "진행 중인 게임이 아닙니다."),
    NOT_PARTICIPANT(HttpStatus.FORBIDDEN, "GAME_005",
            "이 방의 참가자가 아닙니다."),
    NOT_HOST(HttpStatus.FORBIDDEN, "GAME_006",
            "방장만 할 수 있습니다."),

    /** 이미 다른 방에 들어가 있다. 판돈이 두 군데 묶이면 어느 쪽도 정산할 수 없다 */
    ALREADY_IN_ROOM(HttpStatus.CONFLICT, "GAME_007",
            "이미 참여 중인 게임이 있습니다. 그 게임을 먼저 끝내 주세요."),
    NOT_ALL_READY(HttpStatus.CONFLICT, "GAME_008",
            "아직 준비하지 않은 참가자가 있습니다."),

    /** 차례가 아닌 사람이 행동했다. 할리갈리의 종 치기는 차례와 무관해서 여기 걸리지 않는다 */
    NOT_YOUR_TURN(HttpStatus.CONFLICT, "GAME_009",
            "지금은 차례가 아닙니다."),
    INVALID_ACTION(HttpStatus.BAD_REQUEST, "GAME_010",
            "지금 할 수 없는 행동입니다."),

    /** 판돈이 한도를 벗어났다 */
    BET_NOT_ALLOWED(HttpStatus.BAD_REQUEST, "GAME_011",
            "걸 수 있는 금액이 아닙니다."),

    /**
     * 혼자 있는 방에 판돈을 걸려 했다.
     *
     * 🔴 막지 않으면 보조금이 공짜 돈이 된다 — 혼자 걸고 혼자 다 받아가면서 판마다
     * 보조금만큼이 그냥 생긴다. 혼자 하는 방은 연습 모드뿐이다.
     */
    SOLO_BET_NOT_ALLOWED(HttpStatus.BAD_REQUEST, "GAME_012",
            "혼자 하는 방에는 캣머니를 걸 수 없습니다. 연습으로 즐겨 주세요."),

    /** 초대 코드를 여러 번 뽑아도 살아 있는 방과 계속 겹쳤다. 사실상 일어나지 않는다 */
    INVITE_CODE_EXHAUSTED(HttpStatus.SERVICE_UNAVAILABLE, "GAME_013",
            "방을 만들지 못했습니다. 잠시 후 다시 시도해 주세요."),

    /** 게임판 JSON 이 엔진이 아는 모양이 아니다. 배포 중 스키마가 바뀐 판이 남아 있을 때 */
    STATE_CORRUPTED(HttpStatus.INTERNAL_SERVER_ERROR, "GAME_014",
            "게임 상태를 읽지 못했습니다."),

    /** 같은 방의 다른 사람이 이미 그 말 모양을 쓰고 있다 */
    PIECE_STYLE_TAKEN(HttpStatus.CONFLICT, "GAME_015",
            "다른 참가자가 쓰고 있는 말입니다.");

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;
}
