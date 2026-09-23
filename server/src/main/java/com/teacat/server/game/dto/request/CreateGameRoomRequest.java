package com.teacat.server.game.dto.request;

import com.teacat.server.game.engine.yut.YutState;
import com.teacat.server.game.entity.GameType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

@Schema(description = "게임 방 만들기")
public record CreateGameRoomRequest(

        @Schema(description = "게임 종류", example = "YUT")
        @NotNull
        GameType gameType,

        @Schema(description = "1인당 판돈(캣머니). 0이면 연습 모드입니다. 고를 수 있는 값은 정책 조회로 받습니다",
                example = "100")
        @PositiveOrZero
        long betAmount,

        @Schema(description = "최대 인원 1~4. 1이면 혼자 연습하는 방이라 판돈을 걸 수 없습니다", example = "4")
        @Min(1) @Max(4)
        int maxPlayers,

        @Schema(description = "1인당 말 수 1~4 (윷놀이). 안 보내면 4개입니다. 할리갈리는 무시합니다",
                example = "4")
        @Min(1) @Max(4)
        Integer piecesPerPlayer) {

    /** 안 보냈으면 기본값. 말 수를 고르는 화면이 아직 없는 클라이언트도 그대로 동작해야 한다 */
    public int piecesOrDefault() {
        return piecesPerPlayer == null ? YutState.DEFAULT_PIECES : piecesPerPlayer;
    }
}
