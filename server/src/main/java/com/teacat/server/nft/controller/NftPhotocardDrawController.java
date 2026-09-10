package com.teacat.server.nft.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.response.NftPhotocardDrawResponse;
import com.teacat.server.nft.dto.response.NftPhotocardDrawStatusResponse;
import com.teacat.server.nft.dto.response.NftPhotocardPackClaimResponse;
import com.teacat.server.nft.service.NftPhotocardDrawService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * 포토카드 뽑기. 어떤 카드가 나오는지 · 몇 번 뽑을 수 있는지는 전부 서버가 정한다.
 *
 * <p>{@code /photocards/draw} 는 리터럴 경로라 {@code /photocards/{photocardId}} 보다 먼저 매칭된다.
 */
@Tag(name = "NFT 포토카드 뽑기", description = "카드팩 · 뽑기 API")
@RestController
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class NftPhotocardDrawController {

    private final NftPhotocardDrawService drawService;

    @Operation(summary = "남은 카드팩 조회",
            description = "안 쓴 카드팩 수와 뽑기 가능 여부입니다. 내 포토카드의 카드팩 칸과 뽑기 화면의 버튼이 이 값만 봅니다.")
    @GetMapping("/photocards/draw")
    public ResponseEntity<BaseResponse<NftPhotocardDrawStatusResponse>> status(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(drawService.status(authUser.id())));
    }

    @Operation(summary = "카드팩 열기 (뽑기)",
            description = """
                    카드팩 하나를 써서 뽑기 풀 도안 중 하나를 무작위로 발행합니다. 확률은 균등이며 한정 수량이 소진된 도안은 빠집니다.
                    같은 Idempotency-Key 로 다시 오면 새로 뽑지 않고 그때 준 카드를 그대로 돌려줍니다.
                    팩이 없으면 409 NFT_040 이며 message 를 그대로 화면에 띄우면 됩니다.
                    응답 직후 카드는 PENDING 이고 블록 확정(약 10초) 뒤 MINTED 가 됩니다.
                    """)
    @Parameter(name = "Idempotency-Key", description = "중복 뽑기 방지용 UUID", required = true,
            in = ParameterIn.HEADER, example = "550e8400-e29b-41d4-a716-446655440000")
    @PostMapping("/photocards/draw")
    public ResponseEntity<BaseResponse<NftPhotocardDrawResponse>> draw(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey) {
        return ResponseEntity.ok(BaseResponse.success(drawService.draw(authUser.id(), idempotencyKey)));
    }

    @Operation(summary = "이벤트 카드팩 받기",
            description = "로그인 계정당 한 번 카드팩 1개를 줍니다. 이미 받았거나 진행 중인 이벤트가 없으면 granted:false 입니다 (에러 아님).")
    @PostMapping("/photocards/packs/claim")
    public ResponseEntity<BaseResponse<NftPhotocardPackClaimResponse>> claimEventPack(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser) {
        return ResponseEntity.ok(BaseResponse.success(drawService.claimEventPack(authUser.id())));
    }
}
