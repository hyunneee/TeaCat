package com.teacat.server.nft.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftAdminAuctionCancelRequest;
import com.teacat.server.nft.dto.response.NftAdminAuctionDetailResponse;
import com.teacat.server.nft.dto.response.NftAdminAuctionPageResponse;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.service.NftAuctionAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 어드민 경매 관리.
 *
 * <p>사용자 경로({@link NftAuctionController})와 파일을 나눈다 — 한 컨트롤러에 두면
 * 공개 경로와 ADMIN 경로가 섞여서, 나중에 매핑 하나를 추가할 때 어느 쪽에 붙는지
 * 눈으로 알 수 없다.
 */
@Tag(name = "NFT 경매 (어드민)", description = "경매 목록·상세 조회와 강제 취소")
@RestController
@RequestMapping("/admin/nft/auctions")
@SecurityRequirement(name = "bearerAuth")
@RequiredArgsConstructor
public class NftAuctionAdminController {

    private final NftAuctionAdminService auctionAdminService;

    @Operation(summary = "경매 목록",
            description = "모든 상태의 경매를 최근 등록순으로 봅니다. status 로 걸러내고(생략하면 전체) "
                    + "keyword 로 도안명·공연명·판매자 닉네임을 찾습니다.\n\n"
                    + "🔴 마감 시각이 지났는데 아직 ACTIVE 인 행도 그대로 나옵니다 — 숨기면 스위퍼가 멈췄을 때 "
                    + "아무도 모릅니다. 그 경우 `cancellable` 이 false 입니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<NftAdminAuctionPageResponse>> list(
            @RequestParam(required = false) NftAuctionStatus status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(BaseResponse.success(
                auctionAdminService.list(status, keyword, page, size)));
    }

    @Operation(summary = "경매 상세",
            description = "목록 한 줄의 정보에 입찰 이력(최근 입찰부터)을 더해 돌려줍니다. "
                    + "판매자·최고 입찰자의 회원 ID 가 함께 와서 회원 상세로 이어 볼 수 있습니다.\n\n"
                    + "🔴 사용자용 상세와 달리 **지연 마감을 하지 않습니다** — 어드민이 들여다보는 행위가 "
                    + "경매 상태를 바꾸면 안 됩니다.")
    @GetMapping("/{auctionId}")
    public ResponseEntity<BaseResponse<NftAdminAuctionDetailResponse>> get(@PathVariable Long auctionId) {
        return ResponseEntity.ok(BaseResponse.success(auctionAdminService.get(auctionId)));
    }

    @Operation(summary = "경매 강제 취소",
            description = "판매자 취소와 달리 **입찰이 붙은 경매도** 돌립니다. 최고 입찰자의 캣머니 담보를 "
                    + "함께 풀어 줍니다.\n\n"
                    + "🔴 진행 중이고 마감 시각이 지나지 않은 경매만 취소됩니다. 마감 시각이 지난 경매는 "
                    + "`NFT_064` 로 거절합니다 — 스위퍼가 곧 낙찰로 닫을 것이고, 그 틈에 취소하면 정당한 "
                    + "낙찰자의 낙찰을 빼앗습니다. 정산이 시작된 뒤(SETTLING)는 거래 심사가 다룹니다.\n\n"
                    + "⚠️ 사유는 서버 로그에만 남습니다. 지나간 취소 이유는 화면에서 되돌려 볼 수 없습니다.")
    @PostMapping("/{auctionId}/cancel")
    public ResponseEntity<BaseResponse<Void>> cancel(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long auctionId,
            @Valid @RequestBody NftAdminAuctionCancelRequest request) {
        auctionAdminService.forceCancel(authUser.id(), auctionId, request.reason());
        return ResponseEntity.ok(BaseResponse.success("경매를 취소했습니다."));
    }
}
