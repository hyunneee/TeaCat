package com.teacat.server.game.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "방 채팅 한 줄")
public record GameChatMessageResponse(

        @Schema(description = "메시지 번호. 방 안에서만 유일하고, 화면이 새 줄을 알아보는 데 씁니다",
                example = "12")
        long id,

        @Schema(description = "보낸 사람의 자리 번호. 색과 말 모양을 여기서 찾습니다", example = "0")
        int seatNo,

        @Schema(description = "보낸 사람 닉네임", example = "고양이집사")
        String nickname,

        @Schema(description = "내용", example = "윷 한 번만 더!")
        String message,

        LocalDateTime sentAt) {
}
