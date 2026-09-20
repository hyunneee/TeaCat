package com.teacat.server.nft.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.auth.security.ClientRequest;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftAuctionCreateRequest;
import com.teacat.server.nft.dto.request.NftAuctionSort;
import com.teacat.server.nft.dto.request.NftBidRequest;
import com.teacat.server.nft.dto.response.MyNftBidResponse;
import com.teacat.server.nft.dto.response.NftAuctionBidHistoryResponse;
import com.teacat.server.nft.dto.response.NftAuctionDetailResponse;
import com.teacat.server.nft.dto.response.NftAuctionResponse;
import com.teacat.server.nft.dto.response.NftAuctionSummaryResponse;
import com.teacat.server.nft.dto.response.NftBidResponse;
import com.teacat.server.nft.dto.response.NftCursorPageResponse;
import com.teacat.server.nft.dto.response.NftPurchaseResponse;
import com.teacat.server.nft.entity.NftAuctionStatus;
import com.teacat.server.nft.service.NftAuctionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
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

@Tag(name = "NFT 포토카드 경매", description = "NFT 포토카드 공개 오름 입찰 경매 등록 · 입찰 · 즉시구매 API")
@RestController
@RequiredArgsConstructor
public class NftAuctionController {

    private final NftAuctionService auctionService;

    @Operation(
            summary = "진행 중인 경매 목록 조회",
            description = "진행 중(ACTIVE)이고 마감 전인 경매를 커서 기반으로 조회합니다. 공연·도안명 검색과 마감 임박순·현재가순·최신순 정렬을 지원하며, size는 1~100만 허용합니다."
    )
    @GetMapping("/nft-market/auctions")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<NftAuctionSummaryResponse>>> getAuctions(
            @RequestParam(required = false) Long performanceId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "ENDING_SOON") NftAuctionSort sort,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(
                auctionService.getAuctions(performanceId, keyword, sort, cursor, size)));
    }

    /**
     * 공개 API 지만 토큰이 있으면 viewer 블록을 채운다.
     * JWT 필터는 공개 경로에서도 토큰을 읽으므로, 비로그인이면 authUser 가 null 로 들어온다.
     */
    @Operation(
            summary = "경매 상세 조회",
            description = "경매의 현재가·입찰 수·최고 입찰자·마감 시각과 종료된 경매의 낙찰 결과를 조회합니다. "
                    + "마감 시각이 지난 경매는 이 요청에서 즉시 마감 처리되어 확정된 결과를 돌려줍니다. "
                    + "토큰을 함께 보내면 내 관점 정보(viewer)가 포함됩니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/auctions/{auctionId}")
    public ResponseEntity<BaseResponse<NftAuctionDetailResponse>> getAuction(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long auctionId) {
        Long viewerId = authUser == null ? null : authUser.id();
        return ResponseEntity.ok(BaseResponse.success(auctionService.getAuction(auctionId, viewerId)));
    }

    @Operation(
            summary = "경매 입찰 이력 조회",
            description = "경매에 들어온 입찰을 최신순 커서 기반으로 조회합니다. 입찰자 닉네임과 금액은 공개입니다."
    )
    @GetMapping("/auctions/{auctionId}/bids")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<NftAuctionBidHistoryResponse>>> getBids(
            @PathVariable Long auctionId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(auctionService.getBids(auctionId, cursor, size)));
    }

    @Operation(
            summary = "경매 등록",
            description = "본인이 소유한 포토카드를 시작가·(선택)즉시구매가·진행 시간으로 경매에 올립니다. "
                    + "고정가 판매 중이거나 이미 경매가 진행 중인 카드는 등록할 수 없습니다. "
                    + "진행 시간은 서버 설정 범위(기본 1시간~7일) 안이어야 합니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/photocards/{photocardId}/auction")
    public ResponseEntity<BaseResponse<NftAuctionResponse>> createAuction(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long photocardId,
            @Valid @RequestBody NftAuctionCreateRequest request,
            @Parameter(hidden = true) HttpServletRequest http) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(auctionService.createAuction(
                        authUser.id(), photocardId, request, ClientRequest.from(http))));
    }

    @Operation(
            summary = "경매 취소",
            description = "본인이 등록한 경매를 취소합니다. 입찰이 한 건이라도 들어온 경매는 취소할 수 없습니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/auctions/{auctionId}")
    public ResponseEntity<BaseResponse<Void>> cancelAuction(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long auctionId) {
        auctionService.cancelAuction(authUser.id(), auctionId);
        return ResponseEntity.ok(BaseResponse.success("경매가 취소되었습니다."));
    }

    @Operation(
            summary = "입찰",
            description = "현재가보다 높고 즉시구매가보다 낮은 금액으로 입찰합니다. 입찰 금액만큼 캣머니가 묶이며, "
                    + "더 높은 입찰에 밀리면 즉시 풀립니다. 판매자 본인과 현재 최고 입찰자는 입찰할 수 없고, 입찰 철회는 불가능합니다. "
                    + "마감 시각이 지난 경매는 거절됩니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/auctions/{auctionId}/bids")
    public ResponseEntity<BaseResponse<NftBidResponse>> placeBid(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long auctionId,
            @Valid @RequestBody NftBidRequest request,
            @Parameter(hidden = true) HttpServletRequest http) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(BaseResponse.success(auctionService.placeBid(
                        authUser.id(), auctionId, request, ClientRequest.from(http))));
    }

    @Operation(
            summary = "즉시구매",
            description = "판매자가 정한 즉시구매가로 경매를 즉시 끝내고 포토카드를 가져옵니다. "
                    + "현재 최고 입찰자의 묶인 캣머니는 해제됩니다. 필수 UUID Idempotency-Key로 중복 체결을 방지합니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @Parameter(
            name = "Idempotency-Key",
            description = "중복 구매 방지용 UUID",
            required = true,
            in = ParameterIn.HEADER,
            example = "550e8400-e29b-41d4-a716-446655440000"
    )
    @PostMapping("/auctions/{auctionId}/buy-now")
    public ResponseEntity<BaseResponse<NftPurchaseResponse>> buyNow(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @PathVariable Long auctionId,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @Parameter(hidden = true) HttpServletRequest http) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(BaseResponse.success(
                auctionService.buyNow(authUser.id(), auctionId, idempotencyKey, ClientRequest.from(http))));
    }

    @Operation(
            summary = "내가 올린 경매 목록 조회",
            description = "인증 사용자가 판매자로 등록한 경매를 최신순 커서 기반으로 조회합니다. status로 진행 중·낙찰·유찰·취소를 걸러낼 수 있습니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/users/me/auctions")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<NftAuctionSummaryResponse>>> getMyAuctions(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @RequestParam(required = false) NftAuctionStatus status,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size) {
        return ResponseEntity.ok(BaseResponse.success(
                auctionService.getMyAuctions(authUser.id(), status, cursor, size)));
    }

    @Operation(
            summary = "내가 입찰한 경매 목록 조회",
            description = "인증 사용자가 입찰한 경매를 내 마지막 입찰 시각 최신순으로 조회합니다. "
                    + "여러 번 입찰한 경매도 한 줄이며, result로 입찰 중·밀림·낙찰·패찰을 구분합니다."
    )
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/users/me/bids")
    public ResponseEntity<BaseResponse<NftCursorPageResponse<MyNftBidResponse>>> getMyBids(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") Integer size,
            @Parameter(description = "입찰 시작일 YYYY-MM-DD (Asia/Seoul, to와 함께 전달)") @RequestParam(required = false) String from,
            @Parameter(description = "입찰 종료일 YYYY-MM-DD (해당 일 포함)") @RequestParam(required = false) String to) {
        return ResponseEntity.ok(BaseResponse.success(auctionService.getMyBids(authUser.id(), cursor, size, from, to)));
    }
}
