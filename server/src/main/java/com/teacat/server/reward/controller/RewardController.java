package com.teacat.server.reward.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.reward.dto.response.DailyRewardStatusResponse;
import com.teacat.server.reward.dto.response.RewardClaimResponse;
import com.teacat.server.reward.entity.RewardType;
import com.teacat.server.reward.service.RewardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 캣머니 벌기 — 하루 한 번 보상.
 *
 * <p>지급 요청 본문에 <b>금액이 없다.</b> 금액도 하루 한 번도 서버가 정한다
 * ({@code RewardType}). 화면은 "눌렀다" 만 알린다.
 */
@Tag(name = "캣머니 보상", description = "출석 체크 · 송편 잡기 하루 한 번 보상 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/users/me/rewards")
@RequiredArgsConstructor
public class RewardController {

    private final RewardService rewardService;

    @Operation(
            summary = "오늘의 보상 현황",
            description = """
                    종류별로 오늘 받았는지와 받게 될 금액을 돌려줍니다.

                    - `date` 는 **서버(Asia/Seoul) 기준 날짜**입니다. 날이 바뀌는 시점은 기기 시계가 아닙니다.
                    - `amount` 를 화면에 하드코딩하지 말고 이 값을 쓰세요 — 금액이 바뀌어도 화면이 따라옵니다.
                    """
    )
    @ApiResponses(@ApiResponse(responseCode = "200", description = "조회 성공"))
    @GetMapping("/daily")
    public ResponseEntity<BaseResponse<DailyRewardStatusResponse>> daily(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(rewardService.status(authUser.id())));
    }

    @Operation(
            summary = "출석 체크 보상 받기",
            description = """
                    하루 한 번 500 캣머니를 발행합니다.

                    ⚠️ 응답이 와도 잔액은 아직 그대로입니다 — 체인 확정까지 약 10초 걸립니다(`PENDING`).
                    곧바로 잔액을 다시 부르면 옛 값이 옵니다.
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "지급 요청 성공"),
            @ApiResponse(responseCode = "409", description = "`ERR_REWARD_001` : 오늘 이미 받음")
    })
    @PostMapping("/attendance")
    public ResponseEntity<BaseResponse<RewardClaimResponse>> attendance(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success("출석 체크 보상을 지급했습니다.",
                rewardService.claim(authUser.id(), RewardType.ATTENDANCE)));
    }

    @Operation(
            summary = "송편 잡기 완주 보상 받기",
            description = """
                    5단계를 모두 통과했을 때 하루 한 번 1000 캣머니를 발행합니다.

                    ⚠️ **클리어 판정은 브라우저가 합니다.** 서버는 단계를 세지 않으므로 실제로 깼는지는
                    검증되지 않습니다 — 이벤트 보상이고 하루 상한이 있어 지금은 감수합니다.

                    ⚠️ 응답이 와도 잔액은 아직 그대로입니다 — 체인 확정까지 약 10초 걸립니다(`PENDING`).
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "지급 요청 성공"),
            @ApiResponse(responseCode = "409", description = "`ERR_REWARD_001` : 오늘 이미 받음")
    })
    @PostMapping("/songpyeon")
    public ResponseEntity<BaseResponse<RewardClaimResponse>> songpyeon(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success("송편 잡기 보상을 지급했습니다.",
                rewardService.claim(authUser.id(), RewardType.SONGPYEON)));
    }
}
