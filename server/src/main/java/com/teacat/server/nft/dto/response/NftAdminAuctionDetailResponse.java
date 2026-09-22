package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 어드민 경매 상세 — 목록 한 줄 + <b>입찰 이력</b>.
 *
 * <p>어드민이 경매를 들여다보는 이유는 대개 "누가 얼마를 어떤 순서로 넣었나" 이므로
 * 입찰 이력을 <b>같은 응답에</b> 담는다. 사용자용 입찰 이력은 커서 페이지라 화면이 더
 * 불러오기를 붙여야 하지만, 여기서는 한 경매를 다 펼쳐 보는 것이 목적이다.
 *
 * <p>🔴 그래도 상한은 있다({@code bids} 는 최근 입찰부터 정해진 건수까지, 상한은
 * {@code NftAuctionAdminService.BID_LIMIT}) —
 * 입찰이 수천 건 붙은 경매에서 응답이 통째로 커지면 어드민 화면이 멈춘다.
 */
@Schema(description = "어드민 경매 상세")
public record NftAdminAuctionDetailResponse(

        @Schema(description = "경매 정보")
        NftAdminAuctionResponse auction,

        @Schema(description = "판매자 회원 ID — 회원 상세로 이어 보기 위한 값", example = "21")
        Long sellerId,

        @Schema(description = "최고 입찰자 회원 ID. 입찰이 없으면 null", example = "34")
        Long topBidderId,

        @Schema(description = "최고 입찰자 닉네임. 입찰이 없으면 null")
        String topBidderNickname,

        @Schema(description = "입찰 이력 (최근 입찰부터)")
        List<NftAuctionBidHistoryResponse> bids
) {
}
