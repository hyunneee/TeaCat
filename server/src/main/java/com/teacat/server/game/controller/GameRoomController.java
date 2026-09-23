package com.teacat.server.game.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.game.dto.request.CreateGameRoomRequest;
import com.teacat.server.game.dto.request.GameActionRequest;
import com.teacat.server.game.dto.request.GamePieceStyleRequest;
import com.teacat.server.game.dto.request.GameReadyRequest;
import com.teacat.server.game.dto.request.JoinGameRoomRequest;
import com.teacat.server.game.dto.response.GamePolicyResponse;
import com.teacat.server.game.dto.response.GameRoomResponse;
import com.teacat.server.game.service.GameRoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Tag(name = "같이 하는 게임", description = "초대 코드로 모여 캣머니를 걸고 겨루는 게임 (윷놀이 · 할리갈리)")
@RestController
@RequestMapping("/games")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class GameRoomController {

    private final GameRoomService gameRoomService;

    @Operation(summary = "게임 규칙 조회",
            description = "방을 만들기 전에 보여줄 값들입니다. 고를 수 있는 판돈, 보조금, 등수별 배분 비율, "
                    + "그리고 오늘 내가 아직 받을 수 있는 보조금이 옵니다.")
    @GetMapping("/policy")
    public ResponseEntity<BaseResponse<GamePolicyResponse>> policy(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(gameRoomService.policy(authUser.id())));
    }

    @Operation(summary = "지금 들어가 있는 방",
            description = "앱을 다시 켰을 때 돌아갈 방입니다. 없으면 data 가 비어 옵니다.")
    @GetMapping("/rooms/me")
    public ResponseEntity<BaseResponse<GameRoomResponse>> myRoom(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return gameRoomService.myCurrentRoom(authUser.id())
                .map(room -> ResponseEntity.ok(BaseResponse.success(room)))
                .orElseGet(() -> ResponseEntity.ok(BaseResponse.success("참여 중인 게임이 없습니다.")));
    }

    @Operation(summary = "방 만들기",
            description = "초대 코드가 함께 나옵니다. 판돈은 방에 들어오는 순간 묶이고(가용 잔액에서 빠집니다) "
                    + "나가면 풀립니다. 혼자 하는 방(최대 인원 1)에는 판돈을 걸 수 없습니다.")
    @PostMapping("/rooms")
    public ResponseEntity<BaseResponse<GameRoomResponse>> create(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody CreateGameRoomRequest request) {
        GameRoomResponse room = gameRoomService.create(authUser.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success("방을 만들었습니다.", room));
    }

    @Operation(summary = "초대 코드로 들어가기")
    @PostMapping("/rooms/join")
    public ResponseEntity<BaseResponse<GameRoomResponse>> join(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody JoinGameRoomRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                gameRoomService.join(authUser.id(), request.inviteCode())));
    }

    @Operation(summary = "방 현황 조회",
            description = "화면 한 장을 그리는 데 필요한 전부입니다. 할리갈리의 엎어 둔 카드는 장수만 옵니다.")
    @GetMapping("/rooms/{roomId}")
    public ResponseEntity<BaseResponse<GameRoomResponse>> view(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long roomId) {
        return ResponseEntity.ok(BaseResponse.success(gameRoomService.view(authUser.id(), roomId)));
    }

    @Operation(summary = "방 바뀜 구독 (SSE)",
            description = """
                    방이 바뀔 때마다 이벤트가 옵니다. 이벤트에는 <b>게임판이 실려 있지 않습니다</b> —
                    "다시 읽어라" 는 신호일 뿐이라, 받으면 방 현황 조회를 다시 부르면 됩니다.
                    사람마다 가려야 하는 정보가 있어 일부러 이렇게 나눴습니다.

                    이벤트 이름: room(사람이 드나듦) · start(시작) · state(판이 바뀜) ·
                    finished(끝남) · ping(연결 유지).
                    """)
    @GetMapping(value = "/rooms/{roomId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long roomId) {
        return gameRoomService.subscribe(authUser.id(), roomId);
    }

    @Operation(summary = "준비 상태 바꾸기")
    @PatchMapping("/rooms/{roomId}/ready")
    public ResponseEntity<BaseResponse<GameRoomResponse>> ready(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long roomId,
            @Valid @RequestBody GameReadyRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                gameRoomService.setReady(authUser.id(), roomId, request.ready())));
    }

    @Operation(summary = "말 모양 고르기",
            description = "윷놀이에서 내 말로 쓸 그림입니다. 한 방에서 겹칠 수 없고(GAME_015), "
                    + "시작한 뒤에는 바꿀 수 없습니다. 들어올 때 남은 모양 하나가 자동으로 채워져 있습니다.")
    @PatchMapping("/rooms/{roomId}/piece-style")
    public ResponseEntity<BaseResponse<GameRoomResponse>> pieceStyle(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long roomId,
            @Valid @RequestBody GamePieceStyleRequest request) {
        return ResponseEntity.ok(BaseResponse.success(
                gameRoomService.setPieceStyle(authUser.id(), roomId, request.pieceStyle())));
    }

    @Operation(summary = "게임 시작", description = "방장만 할 수 있습니다. 시작하면 더 들어올 수 없습니다.")
    @PostMapping("/rooms/{roomId}/start")
    public ResponseEntity<BaseResponse<GameRoomResponse>> start(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long roomId) {
        return ResponseEntity.ok(BaseResponse.success(gameRoomService.start(authUser.id(), roomId)));
    }

    @Operation(summary = "게임 안에서 행동하기",
            description = """
                    윷놀이 — THROW(던지기) 뒤에 MOVE(piece, value)로 말을 옮깁니다.
                    윷·모가 나오거나 말을 잡으면 한 번 더 던집니다.

                    할리갈리 — 내 차례에 FLIP(카드 뒤집기), 종은 차례와 상관없이 아무 때나 BELL 입니다.
                    같은 순간에 들어온 종은 <b>서버에 먼저 닿은 요청</b>이 이깁니다.
                    """)
    @PostMapping("/rooms/{roomId}/actions")
    public ResponseEntity<BaseResponse<GameRoomResponse>> act(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long roomId,
            @Valid @RequestBody GameActionRequest request) {
        return ResponseEntity.ok(BaseResponse.success(gameRoomService.act(authUser.id(), roomId, request)));
    }

    @Operation(summary = "방 나가기",
            description = "시작 전이면 판돈을 돌려받습니다. 시작한 뒤에 나가면 돌려받지 못하고 꼴찌로 정산됩니다.")
    @PostMapping("/rooms/{roomId}/leave")
    public ResponseEntity<BaseResponse<Void>> leave(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long roomId) {
        gameRoomService.leave(authUser.id(), roomId);
        return ResponseEntity.ok(BaseResponse.success("방에서 나왔습니다."));
    }
}
