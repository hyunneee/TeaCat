package com.teacat.server.nft.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftPhotocardPackInvalidateRequest;
import com.teacat.server.nft.dto.response.NftPhotocardPackAdminResponse;
import com.teacat.server.nft.service.NftPhotocardPackAdminService;
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

import java.util.List;

@Tag(name = "회원 관리", description = "관리자가 특정 회원의 카드팩을 조회하고 무효화하는 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/users/{userId}/photocard-packs")
@RequiredArgsConstructor
public class NftPhotocardPackAdminController {

    private final NftPhotocardPackAdminService packAdminService;

    @Operation(summary = "회원 카드팩 조회", description = "소비·무효화된 팩까지 지급 이력으로 돌려줍니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<List<NftPhotocardPackAdminResponse>>> findAll(
            @Parameter(description = "회원 ID", example = "42") @PathVariable Long userId) {
        return ResponseEntity.ok(BaseResponse.success(packAdminService.findAll(userId)));
    }

    @Operation(summary = "미사용 카드팩 무효화",
            description = "잘못 지급된 미사용 팩을 개봉 대상에서 제외합니다. 행과 지급 출처는 보존됩니다.")
    @PostMapping("/{packId}/invalidation")
    public ResponseEntity<BaseResponse<Void>> invalidate(
            @Parameter(description = "회원 ID", example = "42") @PathVariable Long userId,
            @Parameter(description = "카드팩 ID", example = "12") @PathVariable Long packId,
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Valid @RequestBody NftPhotocardPackInvalidateRequest request) {
        packAdminService.invalidate(userId, packId, authUser.id(), request.reason());
        return ResponseEntity.ok(BaseResponse.success("카드팩을 무효화했습니다."));
    }
}
