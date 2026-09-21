package com.teacat.server.search.service;

import com.teacat.server.nft.dto.request.NftAuctionSort;
import com.teacat.server.nft.dto.request.NftMarketSort;
import com.teacat.server.nft.dto.response.NftAuctionSummaryResponse;
import com.teacat.server.nft.dto.response.NftCursorPageResponse;
import com.teacat.server.nft.dto.response.NftMarketPhotocardResponse;
import com.teacat.server.nft.service.NftAuctionService;
import com.teacat.server.nft.service.NftService;
import com.teacat.server.performance.dto.response.ConcertListResponse;
import com.teacat.server.performance.dto.response.ConcertSummaryResponse;
import com.teacat.server.performance.service.PerformanceService;
import com.teacat.server.search.repository.SearchTrendCacheRepository;
import com.teacat.server.search.repository.SearchTrendRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SearchServiceTests {
    private static final String SESSION = "550e8400-e29b-41d4-a716-446655440000";
    private final PerformanceService performances = mock(PerformanceService.class);
    private final NftService nfts = mock(NftService.class);
    private final NftAuctionService auctions = mock(NftAuctionService.class);
    private final SearchTrendCacheRepository cache = mock(SearchTrendCacheRepository.class);
    private final SearchService service = new SearchService(performances, nfts, auctions, cache,
            mock(SearchTrendRepository.class));

    private void results(boolean concert, boolean photocard) {
        when(performances.getConcerts("Teacat", false, null, 6)).thenReturn(
                new ConcertListResponse(concert ? List.of(mock(ConcertSummaryResponse.class)) : List.of(), null, false));
        when(nfts.getMarketPhotocards(null, "Teacat", NftMarketSort.RECENT, null, 6)).thenReturn(
                new NftCursorPageResponse<>(photocard ? List.of(mock(NftMarketPhotocardResponse.class)) : List.of(), null, false));
        when(auctions.getAuctions(null, "Teacat", NftAuctionSort.RECENT, null, 6)).thenReturn(
                new NftCursorPageResponse<>(List.of(), null, false));
    }

    @Test
    void emptyResultsDoNotConsumeTheSessionDeduplicationKey() {
        results(false, false);
        var response = service.search("Teacat", SESSION);
        assertThat(response.concerts()).isEmpty();
        assertThat(response.photocards()).isEmpty();
        verifyNoInteractions(cache);

        results(true, false);
        service.search("Teacat", SESSION);
        verify(cache).incrementOnce(any(), eq(SESSION), eq("teacat"), eq("Teacat"));
    }

    @Test
    void concertOnlyResultsCount() {
        results(true, false);
        assertThat(service.search("Teacat", SESSION).concerts()).hasSize(1);
        verify(cache).incrementOnce(any(), eq(SESSION), eq("teacat"), eq("Teacat"));
    }

    @Test
    void photocardOnlyResultsCount() {
        results(false, true);
        assertThat(service.search("Teacat", SESSION).photocards()).hasSize(1);
        verify(cache).incrementOnce(any(), eq(SESSION), eq("teacat"), eq("Teacat"));
    }

    @Test
    void bothResultTypesCountOnlyOnce() {
        results(true, true);
        service.search("Teacat", SESSION);
        verify(cache, times(1)).incrementOnce(any(), eq(SESSION), eq("teacat"), eq("Teacat"));
    }

    @Test
    void cacheFailureDoesNotHideSearchResults() {
        results(true, true);
        when(cache.incrementOnce(any(), anyString(), anyString(), anyString()))
                .thenThrow(new IllegalStateException("Redis unavailable"));
        var response = service.search("Teacat", SESSION);
        assertThat(response.concerts()).hasSize(1);
        assertThat(response.photocards()).hasSize(1);
    }

    @Test
    void failedSearchIsNotCounted() {
        results(true, false);
        when(nfts.getMarketPhotocards(null, "Teacat", NftMarketSort.RECENT, null, 6))
                .thenThrow(new IllegalStateException("Search unavailable"));
        assertThatThrownBy(() -> service.search("Teacat", SESSION)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(cache);
    }

    @Test
    void auctionOnlyResultsAreReturnedAndCounted() {
        results(false, false);
        when(auctions.getAuctions(null, "Teacat", NftAuctionSort.RECENT, null, 6)).thenReturn(
                new NftCursorPageResponse<>(List.of(mock(NftAuctionSummaryResponse.class)), null, false));

        assertThat(service.search("Teacat", SESSION).auctions()).hasSize(1);
        verify(cache).incrementOnce(any(), eq(SESSION), eq("teacat"), eq("Teacat"));
    }

    @Test
    void trendsUseThePreviousHourCacheWhenTheSnapshotIsMissing() {
        SearchTrendRepository trends = mock(SearchTrendRepository.class);
        when(trends.findByBucket(any())).thenReturn(List.of());
        when(trends.latestBucket()).thenReturn(java.util.Optional.empty());
        when(cache.topTen(any())).thenReturn(List.of(
                new SearchTrendCacheRepository.CountedKeyword("teacat", "Teacat", 3)));
        SearchService liveService = new SearchService(performances, nfts, auctions, cache, trends);

        var response = liveService.trends();

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().getFirst().keyword()).isEqualTo("Teacat");
        assertThat(response.items().getFirst().searchCount()).isEqualTo(3);
    }
}
