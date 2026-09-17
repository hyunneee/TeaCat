package com.teacat.server.ranking.dto;

public record PopularPhotocardResponse(
        int rank,
        Integer previousRank,
        RankTrend trend,
        long tradeCount,
        long tradedAmount,
        Long designId,
        String designName,
        String imageUrl,
        String performanceTitle,
        Long photocardId,
        Long auctionId,
        String marketType
) {
}
