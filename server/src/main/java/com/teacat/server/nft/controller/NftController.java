package com.teacat.server.nft.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftListingCreateRequest;
import com.teacat.server.nft.dto.request.NftMarketSort;
import com.teacat.server.nft.dto.response.MyNftPhotocardResponse;
import com.teacat.server.nft.dto.response.NftCursorPageResponse;
import com.teacat.server.nft.dto.response.NftDrawPoolCardResponse;
import com.teacat.server.nft.dto.response.NftListingResponse;
import com.teacat.server.nft.dto.response.NftMarketPhotocardResponse;
import com.teacat.server.nft.dto.response.NftPhotocardArtResponse;
import com.teacat.server.nft.dto.response.NftPhotocardDetailResponse;
import com.teacat.server.nft.dto.response.NftPhotocardTradeHistoryResponse;
import com.teacat.server.nft.dto.response.NftPurchaseHistoryResponse;
import com.teacat.server.nft.dto.response.NftPurchaseResponse;
import com.teacat.server.nft.dto.response.NftSaleHistoryResponse;
import com.teacat.server.nft.service.NftPhotocardDesignService;
import com.teacat.server.nft.service.NftPhotocardTemplateService;
import com.teacat.server.nft.service.NftService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "NFT 포토카드", description = "NFT 포토카드 조회 · 판매 · 구매 API")
@RestController
@RequiredArgsConstructor
public class NftController {

    private final NftService nftService;
    private final NftPhotocardTemplateService templateService;
    private final NftPhotocardDesignService designService;

    @Operation(
            summary = "NFT 포토카드 목록 조회",
            description = "현재 판매 중인 포토카드를 커서 기반으로 조회합니다. 공연·도안명 검색과 최신순·가격순 정렬을 지원하며, size는 1~100만 허용합니다."
    )
    @GetMapping("/nft-market/photocards")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<NftMarketPhotocardResponse>>> getMarketPhotocards(
            @RequestParam(required = false) Long performanceId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "RECENT") NftMarketSort sort,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(
                nftService.getMarketPhotocards(performanceId, keyword, sort, cursor, size)));
    }

    @Operation(
            summary = "NFT 포토카드 상세 조회",
            description = "포토카드의 도안·공연·발행 시각·원발행 좌석·현재 소유자·민팅 상태와 활성 판매 정보를 조회합니다. "
                    + "판매 중이 아니면 판매 정보는 null입니다.\n\n"
                    + "🔴 **볼 수 있는 카드가 정해져 있습니다** — 마켓에 올라온 카드(판매 중·경매 중)와 "
                    + "본인이 소유한 카드뿐입니다. 그 밖의 카드는 `NFT_001`(404)입니다. "
                    + "ID 가 순번이라, 열지 않아도 되는 카드를 열어두면 소유자·공연·좌석을 순서대로 긁을 수 있습니다.\n\n"
                    + "좌석(`origin`)의 **열·번호는 소유자 본인에게만** 내려갑니다. 남이 볼 때는 등급·구역까지입니다."
    )
    @GetMapping("/photocards/{photocardId}")
    public ResponseEntity<BaseResponse<NftPhotocardDetailResponse>> getPhotocard(
            /* 이 경로는 permitAll 이라 **비로그인이면 null 입니다.** 토큰이 있으면 필터가
               채워주므로, 본인 카드인지 판정에 그대로 쓸 수 있습니다. */
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long photocardId) {
        return ResponseEntity.ok(BaseResponse.success(
                nftService.getPhotocard(photocardId, authUser == null ? null : authUser.id())));
    }

    @Operation(
            summary = "NFT 포토카드 판매 등록",
            description = "본인이 소유한 포토카드를 CAT 가격과 판매자 설명으로 판매 등록합니다. 이미 판매 중인 카드이거나 소유자가 아니면 등록할 수 없습니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/photocards/{photocardId}/listing")
    public ResponseEntity<BaseResponse<NftListingResponse>> registerListing(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long photocardId,
            @Valid @RequestBody NftListingCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(nftService.registerListing(authUser.id(), photocardId, request)));
    }

    @Operation(
            summary = "NFT 포토카드 판매 취소",
            description = "본인이 등록한 활성 판매를 취소합니다. 이미 판매되었거나 취소된 판매는 다시 취소할 수 없습니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/photocards/{photocardId}/listing")
    public ResponseEntity<BaseResponse<Void>> cancelListing(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long photocardId) {
        nftService.cancelListing(authUser.id(), photocardId);
        return ResponseEntity.ok(BaseResponse.success("판매 등록이 취소되었습니다."));
    }

    @Operation(
            summary = "NFT 포토카드 구매",
            description = "활성 판매를 구매하고 판매 상태·포토카드 소유권·거래 이력을 한 트랜잭션에서 변경합니다. "
                    + "동시 구매는 행 잠금으로 한 건만 체결되며, 필수 UUID Idempotency-Key로 같은 요청의 중복 체결을 방지합니다. "
                    + "현재 CAT 원장 미연동 상태이므로 잔액 차감·판매자 지급과 구매 후 잔액 반환은 추후 추가됩니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @Parameter(
            name = "Idempotency-Key",
            description = "중복 구매 방지용 UUID",
            required = true,
            in = ParameterIn.HEADER,
            example = "550e8400-e29b-41d4-a716-446655440000"
    )
    @PostMapping("/photocards/{photocardId}/purchase")
    public ResponseEntity<BaseResponse<NftPurchaseResponse>> purchase(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long photocardId,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey) {
        return ResponseEntity.ok(BaseResponse.success(
                nftService.purchase(authUser.id(), photocardId, idempotencyKey)));
    }

    @Operation(
            summary = "내 NFT 포토카드 구매 내역 조회",
            description = "인증 사용자가 구매자로 체결한 거래를 최신순 커서 기반으로 조회합니다. size는 1~100만 허용합니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/users/me/photocards/purchases")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<NftPurchaseHistoryResponse>>> getPurchaseHistory(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(
                nftService.getPurchaseHistory(authUser.id(), cursor, size)));
    }

    @Operation(
            summary = "내 NFT 포토카드 판매 내역 조회",
            description = "인증 사용자가 판매자로 체결한 거래를 최신순 커서 기반으로 조회합니다. size는 1~100만 허용합니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/users/me/photocards/sales")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<NftSaleHistoryResponse>>> getSaleHistory(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(
                nftService.getSaleHistory(authUser.id(), cursor, size)));
    }

    @Operation(
            summary = "내 NFT 포토카드 목록 조회",
            description = "인증 사용자가 현재 소유한 포토카드를 최신순 커서 기반으로 조회합니다. listed로 판매 등록 여부를 필터링할 수 있습니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/users/me/photocards")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<MyNftPhotocardResponse>>> getMyPhotocards(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @RequestParam(required = false) Boolean listed,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(
                nftService.getMyPhotocards(authUser.id(), listed, cursor, size)));
    }

    @Operation(
            summary = "NFT 포토카드 거래 내역 조회",
            description = "특정 포토카드에서 체결된 판매자·구매자·체결가 이력을 최신순 커서 기반으로 조회합니다.\n\n"
                    + "🔴 상세 조회와 **같은 범위**입니다 — 마켓에 올라온 카드와 본인 카드만 볼 수 있고, "
                    + "그 밖은 `NFT_001`(404)입니다. 여기에 판매자·구매자 닉네임이 담겨 있어서, "
                    + "상세만 막고 이쪽을 열어두면 같은 정보가 그대로 빠져나갑니다."
    )
    @GetMapping("/photocards/{photocardId}/trades")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<NftPhotocardTradeHistoryResponse>>> getPhotocardTrades(
            /* 상세와 같은 이유로 비로그인이면 null 입니다 */
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long photocardId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(nftService.getPhotocardTrades(
                photocardId, authUser == null ? null : authUser.id(), cursor, size)));
    }

    @Operation(
            summary = "카드 그림 목록 조회",
            description = """
                    등록된 카드 그림(템플릿)을 최신순으로 내려줍니다. 감춘 그림은 빠집니다.

                    같은 목록의 어드민 API(GET /admin/photocard-templates)와 **내용이 다릅니다** —
                    여기에는 이름과 그림 주소만 있고, 발행 수·감춤 여부 같은 운영 정보는 빠집니다.

                    🔴 **카드(소유물)가 아니라 그림입니다.** 누가 무엇을 가졌는지와 무관하고,
                    여기 있는 그림은 이미 마켓·뽑기 화면에 그대로 보이는 것들입니다.
                    """
    )
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/photocard-templates")
    public ResponseEntity<BaseResponse<List<NftPhotocardArtResponse>>> getPhotocardArts() {
        return ResponseEntity.ok(BaseResponse.success(templateService.findArt()));
    }
    @Operation(
            summary = "도감 카드 목록 조회",
            description = """
                    뽑기에서 나올 수 있는 카드 전체입니다. "내 포토카드" 도감이 **아직 없는 칸**을
                    그리려면 가진 것 말고 전체가 필요해서 따로 엽니다.

                    🔴 **공연 좌석에서 나오는 도안은 담기지 않습니다.** 그건 아직 열리지 않은
                    공연의 카드까지 미리 보여주는 셈이고, 역할 꼬리표(`group`)도 뽑기 풀
                    도안에만 붙어 있어 거를 방법이 없습니다.

                    🔴 남은 수량·발급 수량·CID·체인 상태는 **내려주지 않습니다** — 운영 정보입니다.
                    같은 목록의 어드민 API(`GET /admin/photocard-designs/draw-pool`)와 내용이 다릅니다.
                    """
    )
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/photocard-designs/draw-pool")
    public ResponseEntity<BaseResponse<List<NftDrawPoolCardResponse>>> getDrawPoolCards() {
        return ResponseEntity.ok(BaseResponse.success(designService.getDrawPoolCards()));
    }
}
