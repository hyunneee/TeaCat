package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 이상거래 시뮬레이션 한 판의 규모 (AUCTION_FRAUD_DESIGN.md 14-2).
 *
 * <p>전부 선택값이고 비우면 기본값으로 돈다. 기본값은 "규칙이 정상을 오탐하지 않는" 선에서 잡혀 있다 —
 * 정상 표본을 사기 표본보다 훨씬 많이 두는 것이 핵심이다. 실제 이상거래는 드물고,
 * 비율을 1:1 로 만들면 모델이 현실에 없는 분포를 배운다(class imbalance 를 인위적으로 없애면 안 된다).
 */
@Schema(description = "이상거래 시뮬레이션 요청")
public record TradeSimulationRequest(

        @Schema(description = "시장을 이룰 도안 수", defaultValue = "4")
        @Min(1) @Max(20) Integer designs,

        @Schema(description = "도안마다 미리 깔아 둘 과거 거래 수. 시세 중앙값·거래량 기준선이 된다", defaultValue = "16")
        @Min(0) @Max(200) Integer historyPerDesign,

        @Schema(description = "서로 모르는 사람들이 시세대로 주고받는 정상 표본 수", defaultValue = "60")
        @Min(0) @Max(2000) Integer normalTrades,

        @Schema(description = "자전 입찰(shill) 사례 수. 공범이 판매자와 같은 단말·전화번호로 값을 올린다", defaultValue = "6")
        @Min(0) @Max(200) Integer shillCases,

        @Schema(description = "순환 거래 사례 수. 2단(A→B→A)과 3단(A→B→C→A)을 한 쌍씩 만든다", defaultValue = "5")
        @Min(0) @Max(200) Integer circularCases,

        @Schema(description = "매집 사례 수. 한 계정이 한 도안을 쓸어 담는다", defaultValue = "4")
        @Min(0) @Max(100) Integer hoardingCases,

        @Schema(description = "계정 탈취 사례 수. 처음 보는 단말에서 로그인한 직후 평소의 몇 배를 쓴다", defaultValue = "5")
        @Min(0) @Max(200) Integer takeoverCases,

        @Schema(description = "꾸밈 세탁 사례 수. 꾸민 직후 시세 10배로 공범에게 판다 — 규칙은 못 잡는다",
                defaultValue = "6")
        @Min(0) @Max(200) Integer decorCases,

        @Schema(description = "난수 씨앗. 같은 값을 주면 같은 판이 나온다. 비우면 매번 다르다")
        Long seed
) {

    public int designsOr() { return designs == null ? 4 : designs; }
    public int historyPerDesignOr() { return historyPerDesign == null ? 16 : historyPerDesign; }
    public int normalTradesOr() { return normalTrades == null ? 60 : normalTrades; }
    public int shillCasesOr() { return shillCases == null ? 6 : shillCases; }
    public int circularCasesOr() { return circularCases == null ? 5 : circularCases; }
    public int hoardingCasesOr() { return hoardingCases == null ? 4 : hoardingCases; }
    public int takeoverCasesOr() { return takeoverCases == null ? 5 : takeoverCases; }
    public int decorCasesOr() { return decorCases == null ? 6 : decorCases; }
}
