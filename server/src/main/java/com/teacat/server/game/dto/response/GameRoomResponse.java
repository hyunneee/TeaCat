package com.teacat.server.game.dto.response;

import com.teacat.server.game.entity.GameRoomStatus;
import com.teacat.server.game.entity.GameType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Schema(description = "게임 방 현황. 화면 한 장을 그리는 데 필요한 전부입니다")
public record GameRoomResponse(

        @Schema(description = "방 id", example = "42")
        Long roomId,

        @Schema(description = "초대 코드", example = "K7PQ2M")
        String inviteCode,

        GameType gameType,

        GameRoomStatus status,

        @Schema(description = "1인당 판돈", example = "100")
        long betAmount,

        @Schema(description = "최대 인원", example = "4")
        int maxPlayers,

        @Schema(description = "내 자리 번호", example = "0")
        int mySeatNo,

        @Schema(description = "내가 방장인가", example = "true")
        boolean host,

        List<GameParticipantResponse> participants,

        @Schema(description = """
                게임판. 게임마다 모양이 다릅니다.

                🔴 할리갈리의 엎어 둔 카드(hands)는 <b>들어 있지 않습니다</b>. 대신 장수만
                handCounts 로 옵니다 — 본인 것이라도 알려주면 종을 언제 칠지 미리 계산할 수
                있기 때문입니다.
                """)
        Map<String, Object> state,

        @Schema(description = "이번 턴 시한. 넘기면 서버가 대신 진행시킵니다")
        LocalDateTime turnExpiresAt,

        @Schema(description = "지금까지 쌓인 상금(판돈 합계 + 예상 보조금). 끝난 판은 확정값입니다",
                example = "800")
        long prizePool,

        @Schema(description = "그중 운영이 얹어주는 보조금", example = "400")
        long subsidy) {
}
