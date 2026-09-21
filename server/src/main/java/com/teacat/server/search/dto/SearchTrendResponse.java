package com.teacat.server.search.dto;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

public record SearchTrendResponse(
        LocalDateTime bucketStartedAt,
        Instant generatedAt,
        Instant nextRefreshAt,
        List<Item> items
) {
    public record Item(
            int rank,
            Integer previousRank,
            String trend,
            String keyword,
            long searchCount
    ) {
    }
}
