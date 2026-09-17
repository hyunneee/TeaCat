package com.teacat.server.search.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.NftMarketSort;
import com.teacat.server.nft.service.NftService;
import com.teacat.server.performance.service.PerformanceService;
import com.teacat.server.search.dto.SearchTrendResponse;
import com.teacat.server.search.dto.UnifiedSearchResponse;
import com.teacat.server.search.exception.SearchErrorCode;
import com.teacat.server.search.repository.SearchTrendCacheRepository;
import com.teacat.server.search.repository.SearchTrendRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private static final ZoneId ZONE = ZoneId.systemDefault();
    private final PerformanceService performanceService;
    private final NftService nftService;
    private final SearchTrendCacheRepository cacheRepository;
    private final SearchTrendRepository trendRepository;

    @Transactional(readOnly = true)
    public UnifiedSearchResponse search(String rawKeyword, String sessionHeader) {
        String display = displayKeyword(rawKeyword);
        String normalized = display.toLowerCase(Locale.ROOT);
        if (normalized.isBlank() || normalized.length() > 100) {
            throw new BusinessException(SearchErrorCode.INVALID_KEYWORD);
        }

        final String sessionId;
        try {
            sessionId = UUID.fromString(sessionHeader).toString();
        } catch (RuntimeException e) {
            throw new BusinessException(SearchErrorCode.INVALID_SESSION);
        }

        LocalDateTime bucket = LocalDateTime.now().truncatedTo(ChronoUnit.HOURS);
        try {
            cacheRepository.incrementOnce(bucket, sessionId, normalized, display);
        } catch (RuntimeException e) {
            // 검색 결과는 Redis 장애와 무관하게 제공한다. 누락된 통계 한 건보다 검색 가용성이 우선이다.
            log.warn("검색어 집계 실패. bucket={}, keyword={}", bucket, normalized, e);
        }

        return new UnifiedSearchResponse(
                display,
                performanceService.getConcerts(display, false, null, 6).concerts(),
                nftService.getMarketPhotocards(null, display, NftMarketSort.RECENT, null, 6).items());
    }

    @Scheduled(cron = "${search.trends.cron:5 0 * * * *}")
    @Transactional
    public void snapshotLastHour() {
        if (!trendRepository.trySnapshotLock()) return;
        LocalDateTime bucket = LocalDateTime.now().truncatedTo(ChronoUnit.HOURS).minusHours(1);
        List<SearchTrendRepository.Snapshot> snapshots = cacheRepository.topTen(bucket).stream()
                .map(item -> new SearchTrendRepository.Snapshot(0, item.normalizedKeyword(),
                        item.displayKeyword(), item.count()))
                .toList();
        List<SearchTrendRepository.Snapshot> ranked = java.util.stream.IntStream.range(0, snapshots.size())
                .mapToObj(index -> new SearchTrendRepository.Snapshot(index + 1,
                        snapshots.get(index).normalizedKeyword(), snapshots.get(index).displayKeyword(),
                        snapshots.get(index).count()))
                .toList();
        trendRepository.replace(bucket, ranked);
    }

    @Transactional(readOnly = true)
    public SearchTrendResponse trends() {
        LocalDateTime bucket = trendRepository.latestBucket().orElse(null);
        LocalDateTime nextHour = LocalDateTime.now().truncatedTo(ChronoUnit.HOURS).plusHours(1);
        Instant generatedAt = bucket == null
                ? Instant.now()
                : bucket.plusHours(1).atZone(ZONE).toInstant();
        if (bucket == null) {
            return new SearchTrendResponse(null, generatedAt, nextHour.atZone(ZONE).toInstant(), List.of());
        }

        Map<String, Integer> previousRanks = new HashMap<>();
        for (SearchTrendRepository.Snapshot item : trendRepository.findByBucket(bucket.minusHours(1))) {
            previousRanks.put(item.normalizedKeyword(), item.rank());
        }
        List<SearchTrendResponse.Item> items = trendRepository.findByBucket(bucket).stream()
                .map(item -> {
                    Integer previous = previousRanks.get(item.normalizedKeyword());
                    String trend = previous == null ? "NEW"
                            : item.rank() < previous ? "UP"
                            : item.rank() > previous ? "DOWN" : "SAME";
                    return new SearchTrendResponse.Item(item.rank(), previous, trend,
                            item.displayKeyword(), item.count());
                })
                .toList();
        return new SearchTrendResponse(bucket, generatedAt, nextHour.atZone(ZONE).toInstant(), items);
    }

    private String displayKeyword(String keyword) {
        String normalized = Normalizer.normalize(keyword == null ? "" : keyword, Normalizer.Form.NFKC);
        return normalized.trim().replaceAll("\\s+", " ");
    }
}
