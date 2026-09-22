package com.teacat.server.search.dto;

import com.teacat.server.nft.dto.response.NftMarketPhotocardResponse;
import com.teacat.server.nft.dto.response.NftAuctionSummaryResponse;
import com.teacat.server.performance.dto.response.ConcertSummaryResponse;

import java.util.List;

public record UnifiedSearchResponse(
        String keyword,
        List<ConcertSummaryResponse> concerts,
        List<NftMarketPhotocardResponse> photocards,
        List<NftAuctionSummaryResponse> auctions
) {
}
