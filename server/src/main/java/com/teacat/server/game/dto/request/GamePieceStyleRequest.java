package com.teacat.server.game.dto.request;

import com.teacat.server.game.entity.GamePieceStyle;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "말 모양 고르기")
public record GamePieceStyleRequest(

        @Schema(description = "말 모양. 한 방에서 겹칠 수 없습니다", example = "CAT")
        @NotNull
        GamePieceStyle pieceStyle) {
}
