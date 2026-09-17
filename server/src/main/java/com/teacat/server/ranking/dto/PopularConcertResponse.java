package com.teacat.server.ranking.dto;

public record PopularConcertResponse(
        int rank,
        Integer previousRank,
        RankTrend trend,
        long score,
        Long concertId,
        String title,
        String stadiumName,
        String posterUrl
) {
}
