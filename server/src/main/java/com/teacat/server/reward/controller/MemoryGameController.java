package com.teacat.server.reward.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.reward.dto.request.MemoryGameClearRequest;
import com.teacat.server.reward.dto.response.MemoryGameResultResponse;
import com.teacat.server.reward.dto.response.MemoryGameStartResponse;
import com.teacat.server.reward.dto.response.MemoryRankingResponse;
import com.teacat.server.reward.service.MemoryGameService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "짝 맞추기", description = "포토카드 짝 맞추기 기록과 일일 랭킹 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/users/me/games/memory")
@RequiredArgsConstructor
public class MemoryGameController {

    private final MemoryGameService memoryGameService;

    @Operation(
            summary = "짝 맞추기 시작",
            description = """
                    판을 열고 `sessionId` 를 받습니다. **이 순간이 시작 시각**입니다.

                    🔴 걸린 시간은 서버가 잽니다. 클리어할 때 시간을 보내지 않고 `sessionId` 만 돌려주세요 —
                    화면이 보낸 시간을 믿으면 매일 1등이 조작됩니다.

                    판을 열고 끝내지 않아도 벌점은 없습니다. 끝나지 않은 판은 랭킹에 들지 않습니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "시작"),
            @ApiResponse(responseCode = "404", description = "`ERR_USER_001` : 존재하지 않는 회원")
    })
    @PostMapping
    public ResponseEntity<BaseResponse<MemoryGameStartResponse>> start(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(memoryGameService.start(authUser.id())));
    }

    @Operation(
            summary = "짝 맞추기 클리어",
            description = """
                    판을 끝냈다고 알립니다. 서버가 시작 시각에서 빼서 걸린 시간을 확정하고 랭킹에 올립니다.

                    사람마다 **그날 가장 빠른 판 하나**만 순위에 오릅니다. 여러 번 해도 순위표를 혼자 채우지 않습니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "기록 완료"),
            @ApiResponse(responseCode = "404", description = "`ERR_REWARD_003` : 내 판이 아니거나 없음"),
            @ApiResponse(responseCode = "409", description = "`ERR_REWARD_004` : 이미 끝난 판")
    })
    @PatchMapping("/{sessionId}")
    public ResponseEntity<BaseResponse<MemoryGameResultResponse>> clear(
            @PathVariable Long sessionId,
            @Valid @RequestBody MemoryGameClearRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(
                memoryGameService.clear(authUser.id(), sessionId, request.moves())));
    }

    @Operation(
            summary = "짝 맞추기 일일 랭킹",
            description = """
                    오늘 랭킹(빠른 순 상위 10명)과 내 등수, 그리고 어제 1등을 돌려줍니다.

                    - 같은 기록이면 **먼저 세운 사람**이 위입니다.
                    - 순위표 안에 내가 있으면 `myRank` 는 null 입니다 (같은 줄을 두 번 그리지 않게).
                    - 어제 1등에게는 `prize` 만큼의 캣머니가 **다음날 자동으로** 들어갑니다. 누르는 버튼은 없습니다.
                    """
    )
    @ApiResponses(@ApiResponse(responseCode = "200", description = "조회 성공"))
    @GetMapping("/ranking")
    public ResponseEntity<BaseResponse<MemoryRankingResponse>> ranking(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(memoryGameService.ranking(authUser.id())));
    }
}
