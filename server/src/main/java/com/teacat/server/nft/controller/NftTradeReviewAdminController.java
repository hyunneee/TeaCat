package com.teacat.server.nft.controller;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.common.response.BaseResponse;
import com.teacat.server.nft.dto.request.NftTradeReviewDecisionRequest;
import com.teacat.server.nft.dto.request.TradeSimulationRequest;
import com.teacat.server.nft.dto.response.NftAdminTradePageResponse;
import com.teacat.server.nft.dto.response.NftTradeReviewDetailResponse;
import com.teacat.server.nft.dto.response.NftTradeReviewPageResponse;
import com.teacat.server.nft.dto.response.NftTradeReviewStatsResponse;
import com.teacat.server.nft.dto.response.TradeSimulationResponse;
import com.teacat.server.nft.service.NftTradeReviewService;
import com.teacat.server.nft.service.NftTradeRiskSimulator;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 이상거래 심사 관리자 API (AUCTION_FRAUD_DESIGN.md 9장).
 *
 * <p>{@code /admin/**} 은 {@code SecurityConfig} 에서 ADMIN 전용이다. 여기서 역할을 다시 검사하지 않는다.
 * 상세에는 이메일·요청 IP 가 실린다 — 관리자 화면 전용이고 사용자 API 로 새지 않는다.
 */
@Tag(name = "NFT 거래 심사 관리", description = "이상거래 규칙에 걸려 정산이 보류된 거래를 보고 승인·거절하는 관리자 API")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/admin/nft/trade-reviews")
@RequiredArgsConstructor
public class NftTradeReviewAdminController {

    private final NftTradeReviewService reviewService;
    private final NftTradeRiskSimulator simulator;

    @Operation(summary = "이상거래 시뮬레이션 (개발용)",
            description = """
                    학습용 데이터를 만듭니다. 가짜 사용자가 시장을 이루고 일부에게 사기 대본
                    (자전 입찰·순환 거래·매집·계정 탈취)을 준 뒤, 운영과 같은 심사 경로에 태웁니다.
                    응답은 대본(정답) 대비 규칙의 성적표입니다.

                    🔴 로컬·개발 DB 전용입니다. 만들어진 거래는 COMPLETED 로 들어가 시세·거래량·인기 순위에
                    그대로 섞입니다. nft.trade.simulator.enabled 가 기본 false 라 배포본에서는 NFT_060 으로 거절됩니다.
                    """)
    @PostMapping("/simulate")
    public ResponseEntity<BaseResponse<TradeSimulationResponse>> simulate(
            @Valid @RequestBody TradeSimulationRequest request) {
        return ResponseEntity.ok(BaseResponse.success(simulator.simulate(request)));
    }

    @Operation(summary = "거래 심사 목록",
            description = "OPEN 은 결정 대기(오래된 순), DECIDED 는 결정 완료(최근 결정 순)입니다. "
                    + "판매자·구매자의 최근 90일 심사 등장 횟수로 반복 등장 계정을 알아볼 수 있습니다.")
    @GetMapping
    public ResponseEntity<BaseResponse<NftTradeReviewPageResponse>> list(
            @RequestParam(defaultValue = "OPEN") NftTradeReviewService.ListStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(BaseResponse.success(reviewService.list(status, page, size)));
    }

    @Operation(summary = "거래 내역 (전체)",
            description = "경매 낙찰·즉시구매·고정가 구매를 가리지 않고 모든 포토카드 거래를 최신순으로 봅니다. "
                    + "status 로 REVIEW(심사 대기)·IN_PROGRESS(체인 전송 중)·COMPLETED·FAILED 를 걸러낼 수 있고, "
                    + "심사에 걸린 거래는 reviewId 로 심사 상세에 이어집니다. 관리자에게는 RISK_REVIEW·RISK_REJECTED 가 가려지지 않습니다.")
    @GetMapping("/trades")
    public ResponseEntity<BaseResponse<NftAdminTradePageResponse>> listTrades(
            @RequestParam(defaultValue = "ALL") NftTradeReviewService.TradeFilter status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(BaseResponse.success(reviewService.listTrades(status, page, size)));
    }

    @Operation(summary = "거래 심사 통계", description = "최근 30일 거래·심사·결정 수와 규칙별 적중 수. 대시보드 카드용입니다.")
    @GetMapping("/stats")
    public ResponseEntity<BaseResponse<NftTradeReviewStatsResponse>> stats() {
        return ResponseEntity.ok(BaseResponse.success(reviewService.stats()));
    }

    @Operation(summary = "거래 심사 상세",
            description = "규칙 근거(signals)·AI 분석 보고서·입찰 타임라인·같은 도안 최근 거래·판매자와 구매자 계정 비교를 한 번에 줍니다.")
    @GetMapping("/{reviewId}")
    public ResponseEntity<BaseResponse<NftTradeReviewDetailResponse>> get(
            @Parameter(description = "심사 ID", example = "12") @PathVariable Long reviewId) {
        return ResponseEntity.ok(BaseResponse.success(reviewService.get(reviewId)));
    }

    @Operation(summary = "거래 심사 승인",
            description = "거래를 정산 대기(PENDING)로 되돌립니다. 다음 주기에 정산 스케줄러가 집어 캣머니·카드 체인 전송을 그대로 이어갑니다. "
                    + "이미 결정이 끝난 심사는 409(NFT_056)입니다.")
    @PostMapping("/{reviewId}/approve")
    public ResponseEntity<BaseResponse<Void>> approve(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "심사 ID", example = "12") @PathVariable Long reviewId,
            @Valid @RequestBody(required = false) NftTradeReviewDecisionRequest request) {
        reviewService.approve(authUser.id(), reviewId, request == null ? null : request.note());
        return ResponseEntity.ok(BaseResponse.success("심사를 승인했습니다. 정산이 재개됩니다."));
    }

    @Operation(summary = "거래 심사 거절",
            description = "구매자·판매자의 묶인 캣머니를 풀고 거래를 실패(RISK_REJECTED)로 끝냅니다. 카드는 판매자에게 그대로 남습니다. "
                    + "자연 낙찰은 유찰, 즉시구매는 경매 재개, 고정가는 판매 재개입니다. 사유는 필수(NFT_058)입니다.")
    @PostMapping("/{reviewId}/reject")
    public ResponseEntity<BaseResponse<Void>> reject(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthUser authUser,
            @Parameter(description = "심사 ID", example = "12") @PathVariable Long reviewId,
            @Valid @RequestBody NftTradeReviewDecisionRequest request) {
        reviewService.reject(authUser.id(), reviewId, request.note());
        return ResponseEntity.ok(BaseResponse.success("심사를 거절했습니다. 묶인 캣머니가 해제됩니다."));
    }
}
