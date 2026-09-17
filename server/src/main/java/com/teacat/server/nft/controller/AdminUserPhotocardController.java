package com.teacat.server.nft.controller;

import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.response.MyNftPhotocardResponse;
import com.teacat.server.nft.dto.response.NftCursorPageResponse;
import com.teacat.server.nft.dto.response.NftPurchaseHistoryResponse;
import com.teacat.server.nft.dto.response.NftSaleHistoryResponse;
import com.teacat.server.nft.service.NftService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 회원 상세의 "포토카드" 탭.
 *
 * <p>{@link NftController} 의 {@code /users/me/photocards*} 와 <b>같은 서비스</b>를 부릅니다.
 * 회원을 토큰이 아니라 경로에서 얻는 것만 다릅니다 ({@code AdminTicketController} 와 같은 규칙).
 *
 * <p>🔴 <b>소유 판정은 우리 DB 입니다</b> — {@code nft_photocards.owner_id}. 체인에 묻지 않으므로
 * 관리자 화면에서 목록을 넘겨도 비용이 붙지 않습니다.
 *
 * <p>접근 제어는 {@code SecurityConfig} 의 {@code /admin/**}(ADMIN 전용)이 맡습니다.
 */
@Tag(name = "회원 관리", description = "관리자가 특정 회원의 포토카드를 조회하는 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/users/{userId}/photocards")
@RequiredArgsConstructor
public class AdminUserPhotocardController {

    private final NftService nftService;

    @Operation(summary = "회원 보유 포토카드 조회",
            description = "그 회원이 **지금 가지고 있는** 카드입니다. 판매 등록 중인 카드도 아직 "
                    + "본인 소유라 함께 나오며, `listed` 로 걸러낼 수 있습니다. "
                    + "최신순 커서 페이지이고 size 는 1~100 입니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<NftCursorPageResponse<MyNftPhotocardResponse>>> getUserPhotocards(
            @Parameter(description = "회원 ID", example = "42") @PathVariable Long userId,
            @Parameter(description = "고정가 또는 경매 판매 진행 여부로 거르기. 비우면 전체") @RequestParam(required = false) Boolean listed,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(
                nftService.getMyPhotocards(userId, listed, cursor, size)));
    }

    @Operation(summary = "회원 포토카드 구매 내역 조회",
            description = "그 회원이 **구매자로** 체결한 거래입니다. 지금 보유한 카드와 다릅니다 — "
                    + "샀다가 되판 카드도 여기 남습니다.")
    @GetMapping("/purchases")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<NftPurchaseHistoryResponse>>> getUserPurchases(
            @Parameter(description = "회원 ID", example = "42") @PathVariable Long userId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(
                nftService.getPurchaseHistory(userId, cursor, size)));
    }

    @Operation(summary = "회원 포토카드 판매 내역 조회",
            description = "그 회원이 **판매자로** 체결한 거래입니다.")
    @GetMapping("/sales")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<NftSaleHistoryResponse>>> getUserSales(
            @Parameter(description = "회원 ID", example = "42") @PathVariable Long userId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(
                nftService.getSaleHistory(userId, cursor, size)));
    }
}
