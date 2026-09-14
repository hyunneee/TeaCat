package com.teacat.server.wallet.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.wallet.dto.request.AdminCatMoneyAdjustRequest;
import com.teacat.server.wallet.dto.response.AdminCatMoneyAdjustResponse;
import com.teacat.server.wallet.dto.response.BalanceResponse;
import com.teacat.server.wallet.service.AdminCatMoneyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 대시보드의 캣머니 조정 API — <b>테스트용</b>이다.
 *
 * <p>QA 가 예매·경매·포카 마켓을 돌려보려면 잔액이 있어야 하는데 매번 토스 결제창을 태울 수
 * 없어서 둔다. 넣기와 빼기를 <b>다른 경로</b>로 나눈 이유는, 금액의 부호로 방향을 주면
 * -1000 을 1000 으로 잘못 읽는 실수가 조용히 돈을 넣어버리기 때문이다.
 *
 * <p>{@code /admin/**} 은 {@code SecurityConfig} 에서 ADMIN 전용이다. STADIUM·PERFORMANCE 는
 * 대시보드에 들어올 수는 있지만 이 API 는 403 이다.
 */
@Tag(name = "캣머니 관리", description = "관리자가 회원 캣머니를 넣거나 빼는 테스트용 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/users/{userId}/catmoney")
@RequiredArgsConstructor
public class AdminCatMoneyController {

    private final AdminCatMoneyService adminCatMoneyService;

    @Operation(summary = "회원 캣머니 잔액 조회",
            description = "회원 본인이 보는 값과 같습니다. available(체인 잔액 − 묶인 돈 − 미확정 소각)이 "
                    + "실제로 쓸 수 있는 금액이고, 빼기의 상한도 이 값입니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<BalanceResponse>> getBalance(
            @Parameter(description = "회원 ID", example = "42") @PathVariable Long userId) {
        return ResponseEntity.ok(BaseResponse.success(adminCatMoneyService.getBalance(userId)));
    }

    @Operation(summary = "회원 캣머니 지급",
            description = "요청한 금액만큼 새로 발행해 넣어줍니다. 원화 입금 없이 만드는 돈이라 원장에는 "
                    + "ADMIN_GRANT 로 남고 매출 집계에서 제외해야 합니다.\n\n"
                    + "⚠️ 응답이 와도 잔액은 아직 그대로입니다 — 체인 확정까지 약 10초 걸립니다(PENDING).")
    @PostMapping("/grant")
    public ResponseEntity<BaseResponse<AdminCatMoneyAdjustResponse>> grant(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "회원 ID", example = "42") @PathVariable Long userId,
            @Valid @RequestBody AdminCatMoneyAdjustRequest request) {
        return ResponseEntity.ok(BaseResponse.success("캣머니 지급을 요청했습니다.",
                adminCatMoneyService.grant(authUser.id(), userId, request.amount())));
    }

    @Operation(summary = "회원 캣머니 차감",
            description = "요청한 금액만큼 소각합니다. **가용 잔액보다 많이 요청하면 가용 잔액만큼만 "
                    + "깎습니다** — 넉넉한 수를 넣어 잔액을 0 으로 만드는 용도입니다. 실제로 빠진 금액은 "
                    + "응답의 appliedAmount 를 보세요.\n\n"
                    + "가용 잔액이 0 이면 409 입니다(뺄 돈이 없습니다).")
    @PostMapping("/burn")
    public ResponseEntity<BaseResponse<AdminCatMoneyAdjustResponse>> burn(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "회원 ID", example = "42") @PathVariable Long userId,
            @Valid @RequestBody AdminCatMoneyAdjustRequest request) {
        return ResponseEntity.ok(BaseResponse.success("캣머니 차감을 요청했습니다.",
                adminCatMoneyService.burn(authUser.id(), userId, request.amount())));
    }
}
