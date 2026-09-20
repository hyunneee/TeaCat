package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 내 포토카드 **요약** — 도감이 필요로 하는 것만 한 번에.
 *
 * <p>도감은 "이 도안을 몇 장 가졌나 · 그중 몇 장이 마켓에 나가 있나" 만 알면 된다. 그걸 알려고 카드
 * 목록을 페이지마다 끝까지 받아 오던 것을 이 응답 하나로 대신한다. 카드 한 장 한 장이 필요한
 * 화면("보유 카드만")은 기존 목록 API({@code /users/me/photocards})를 그때 부른다.
 */
@Schema(description = "내 포토카드 요약 (도안별 보유 수·판매 상태)")
public record MyNftPhotocardSummaryResponse(

        @Schema(description = "도안별 요약. 가진 도안만 온다")
        List<Design> designs,

        @Schema(description = "아직 끝나지 않은 카드 수 — 발행 중(PENDING)이거나 거래 정산 중(SETTLING). "
                + "0 이면 화면이 다시 물어볼 이유가 없다", example = "1")
        long pendingCount
) {

    @Schema(description = "도안 하나")
    public record Design(
            @Schema(description = "도안 ID", example = "11") Long designId,

            @Schema(description = "가진 장수", example = "3") int count,

            @Schema(description = "그중 마켓에 나간 장수 (고정가·경매·정산 중 모두). count 에서 빼지 않는다",
                    example = "1") int marketCount,

            @Schema(description = "마켓에 나간 것 중 대표 한 장의 상태. 없으면 null", example = "AUCTION")
            MarketState marketState,

            @Schema(description = "눌렀을 때 열 대표 카드. **보관 중인 카드를 먼저** 고른다 — 세 장 중 한 장만 "
                    + "올려 둔 사람이 판매 중인 카드 상세로 떨어지면 막힌 길이라서다", example = "101")
            Long photocardId
    ) {
    }

    public enum MarketState {
        LISTED,
        AUCTION,
        SETTLING
    }
}
