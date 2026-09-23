package com.teacat.server.nft.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftDecorationSaveRequest;
import com.teacat.server.nft.dto.response.NftDecorationResponse;
import com.teacat.server.nft.service.NftDecorationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 포카 꾸미기 — 내 포토카드에 AI 스티커를 얹은 결과.
 *
 * <p>🔴 셋 다 <b>소유자만</b> 부를 수 있다. 화면에서도 막지만 여기서 다시 확인한다 —
 * 경로의 photocardId 를 믿지 않는다.
 */
@Tag(name = "포카 꾸미기", description = "포토카드에 AI 스티커를 얹은 결과")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/photocards/{photocardId}/decoration")
@RequiredArgsConstructor
public class NftDecorationController {

    private final NftDecorationService decorationService;

    @Operation(summary = "꾸민 카드 저장",
            description = "이미 있으면 덮어씁니다. 카드당 하나이며, 합성된 PNG 는 클라이언트가 만들어 보냅니다.")
    @PutMapping
    public ResponseEntity<BaseResponse<NftDecorationResponse>> save(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long photocardId,
            @Valid @RequestBody NftDecorationSaveRequest request) {
        return ResponseEntity.ok(BaseResponse.success("저장했습니다.",
                decorationService.save(authUser.id(), photocardId, request)));
    }

    @Operation(summary = "꾸민 카드 조회",
            description = "다시 꾸밀 때 씁니다. 꾸민 적이 없으면 404(NFT_065)이며 이는 정상 상태입니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<NftDecorationResponse>> find(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long photocardId) {
        return ResponseEntity.ok(BaseResponse.success(
                decorationService.find(photocardId)));
    }

    /*
     * 🔴 꾸밈 지우기(DELETE)는 **없앴다** (2026-09-23).
     *    스티커는 붙이면 못 떼는데 꾸밈을 통째로 지울 수 있으면 그 스티커들이 증발한다.
     */
}
