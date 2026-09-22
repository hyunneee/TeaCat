package com.teacat.server.nft.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 어드민 경매 목록 페이지.
 *
 * <p>거래 심사·문의 목록과 <b>같은 모양</b>이다({@link NftTradeReviewPageResponse}) —
 * 어드민 화면들이 같은 표·페이지 부품을 쓰기 때문에 봉투가 어긋나면 부품을 또 만들게 된다.
 */
@Schema(description = "어드민 경매 목록 페이지")
public record NftAdminAuctionPageResponse(

        @Schema(description = "목록")
        List<NftAdminAuctionResponse> auctions,

        @Schema(description = "현재 페이지 (0부터)", example = "0")
        int page,

        @Schema(description = "페이지 크기", example = "20")
        int size,

        @Schema(description = "전체 개수", example = "37")
        long totalElements,

        @Schema(description = "전체 페이지 수", example = "2")
        int totalPages
) {

    public static NftAdminAuctionPageResponse of(List<NftAdminAuctionResponse> auctions,
                                                 int page, int size, long totalElements) {
        int totalPages = size <= 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        return new NftAdminAuctionPageResponse(auctions, page, size, totalElements, totalPages);
    }
}
