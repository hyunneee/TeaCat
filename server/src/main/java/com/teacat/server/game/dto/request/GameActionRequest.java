package com.teacat.server.game.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = """
        게임 안에서 하는 행동.

        윷놀이 — THROW(던지기) · MOVE(piece 번호와 value 로 말 옮기기)
        할리갈리 — FLIP(내 차례에 카드 뒤집기) · BELL(아무 때나 종 치기)
        """)
public record GameActionRequest(

        @Schema(description = "행동 이름", example = "THROW")
        @NotBlank
        String action,

        @Schema(description = "윷놀이에서 움직일 말 번호 0~3", example = "0")
        Integer piece,

        @Schema(description = "윷놀이에서 쓸 던지기 결과 1~5 (도개걸윷모)", example = "3")
        Integer value) {
}
