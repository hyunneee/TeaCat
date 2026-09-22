package com.teacat.server.game.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Schema(description = "초대 코드로 방 들어가기")
public record JoinGameRoomRequest(

        @Schema(description = "초대 코드 6자. 대소문자를 가리지 않습니다", example = "K7PQ2M")
        @NotBlank
        @Pattern(regexp = "(?i)[A-Z0-9]{4,8}", message = "초대 코드 형식이 아닙니다.")
        String inviteCode) {
}
