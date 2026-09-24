package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftTradeRiskSignal;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** 관리자 심사 상세 — 목록 한 줄 + 규칙 근거 + 모델 판단 + 입찰·거래 타임라인 + 계정 비교 */
public record NftTradeReviewDetailResponse(

        NftTradeReviewSummaryResponse summary,

        @Schema(description = "규칙 신호 전체. evidence 는 숫자·불리언·내부 id 만 담는다")
        List<NftTradeRiskSignal> signals,

        @Schema(description = "AI 분석 보고서(설계 문서 7-3 스키마). 없으면 null")
        Map<String, Object> analysis,

        @Schema(description = "분석에 쓴 모델", example = "claude-opus-5")
        String analysisModel,

        @Schema(description = """
                섀도우 모델의 부정 확률 0~1 과 그 판단에 기여한 피처들.
                🔴 이 값은 아무 결정도 하지 않습니다 — 관리자가 보고 참고할 뿐입니다.
                채점 당시와 지금 모델이 다르면 explanation 이 비고 staleModel 이 true 입니다.
                """)
        ModelInsight model,

        @Schema(description = "결정한 관리자 ID. 자동 승인이면 null")
        Long decidedBy,

        @Schema(description = "결정 사유")
        String decisionNote,

        @Schema(description = "판매자와 구매자가 같은 IP 에서 요청했나. 단말 정보가 없으면 null")
        Boolean sameIp,

        @Schema(description = "판매자와 구매자가 같은 브라우저(UA 해시)에서 요청했나. 단말 정보가 없으면 null")
        Boolean sameUserAgent,

        PartyDetail seller,

        PartyDetail buyer,

        @Schema(description = "경매면 입찰 이력(시간순). 고정가면 빈 목록")
        List<Bid> bids,

        @Schema(description = "같은 도안의 최근 완료 거래(최신순, 최대 10건)")
        List<RecentTrade> recentDesignTrades
) {

    /** 관리자 화면이라 실계정 매핑에 필요한 만큼 준다. 전화번호는 "같음/다름" 만 목록·신호에 있고 여기도 원문은 안 준다 */
    /**
     * 섀도우 모델의 판단과 그 근거.
     *
     * <p>🔴 로지스틱 회귀라 점수가 각 피처 기여의 <b>단순 합</b>이다. 그래서 "왜 이 점수인가" 를
     * 추측이 아니라 계산으로 답할 수 있다 — 설명 가능한 모델을 기준선으로 고른 값이 여기서 나온다.
     *
     * @param score        부정 확률 0~1. 모델이 없거나 학습 범위 밖이면 null
     * @param version      그 점수를 낸 모델 판
     * @param staleModel   채점 당시 모델과 지금 적재된 모델이 다른가. true 면 근거를 보여주지 않는다
     * @param explanation  기여가 큰 순서. 양수는 부정 쪽, 음수는 정상 쪽으로 민 것
     */
    public record ModelInsight(Double score, String version, boolean staleModel,
                               List<Factor> explanation) {

        public static final ModelInsight NONE = new ModelInsight(null, null, false, List.of());
    }

    /** @param contribution 로짓 기여도. 부호가 방향, 크기가 영향력이다 */
    public record Factor(String label, double contribution) {}

    public record PartyDetail(
            @Schema(description = "회원 ID") Long userId,
            @Schema(description = "닉네임") String nickname,
            @Schema(description = "이메일") String email,
            @Schema(description = "가입 시각") LocalDateTime createdAt,
            @Schema(description = "최근 90일 심사 등장 횟수 (이 건 포함)") long reviewAppearances90d,
            @Schema(description = "이 거래 요청 단말의 IP. 관리자 화면 전용") String ip
    ) {
    }

    public record Bid(
            @Schema(description = "입찰 ID") Long bidId,
            @Schema(description = "입찰자 ID") Long bidderId,
            @Schema(description = "입찰자 닉네임") String bidderNickname,
            @Schema(description = "금액(CAT)") Long amount,
            @Schema(description = "입찰 시각") LocalDateTime createdAt,
            @Schema(description = "판매자 등록 단말과 같은 IP 에서 들어온 입찰인가. 단말 정보가 없으면 null") Boolean sameIpAsSeller,
            @Schema(description = "판매자 등록 단말과 IP·UA 가 모두 같은가. 단말 정보가 없으면 null") Boolean sameDeviceAsSeller
    ) {
    }

    public record RecentTrade(
            @Schema(description = "거래 ID") Long tradeId,
            @Schema(description = "거래가(CAT)") Long price,
            @Schema(description = "완료 시각") LocalDateTime completedAt,
            @Schema(description = "이 심사의 판매자 또는 구매자가 낀 거래인가") boolean involvesParties
    ) {
    }
}
