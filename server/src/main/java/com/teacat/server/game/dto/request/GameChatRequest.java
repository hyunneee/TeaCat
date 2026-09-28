package com.teacat.server.game.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "방 채팅 보내기")
public record GameChatRequest(

        @Schema(description = "내용. 200자까지", example = "윷 한 번만 더!")
        @NotBlank
        @Size(max = 200)
        String message) {
}
