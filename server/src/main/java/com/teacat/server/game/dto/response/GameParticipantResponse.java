package com.teacat.server.game.dto.response;

import com.teacat.server.game.entity.GameParticipantStatus;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "방에 앉은 사람")
public record GameParticipantResponse(

        @Schema(description = "자리 번호 0~3. 게임판에서 이 사람을 가리키는 번호입니다", example = "0")
        int seatNo,

        @Schema(description = "닉네임", example = "고양이집사")
        String nickname,

        @Schema(description = "방장인가", example = "true")
        boolean host,

        @Schema(description = "나인가", example = "false")
        boolean me,

        @Schema(description = "준비했나", example = "true")
        boolean ready,

        @Schema(description = "참가 상태", example = "PLAYING")
        GameParticipantStatus status,

        @Schema(description = "정산된 등수. 아직이면 null", example = "1")
        Integer rank,

        @Schema(description = "정산된 수령액. 아직이면 null", example = "1400")
        Long payout) {
}
