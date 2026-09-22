package com.teacat.server.game.dto.request;

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
        int maxPlayers) {
}
