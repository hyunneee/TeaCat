package com.teacat.server.ranking.service;

import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.ranking.dto.PopularConcertResponse;
import com.teacat.server.ranking.dto.PopularPhotocardResponse;
import com.teacat.server.ranking.dto.RankTrend;
import com.teacat.server.ranking.repository.RankingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RankingService {

    private final RankingRepository rankingRepository;
    private final FileStorageService fileStorageService;

    public List<PopularConcertResponse> popularConcerts() {
        LocalDateTime now = LocalDateTime.now();
        return rankingRepository.findPopularConcerts(now.minusHours(48), now.minusHours(24), now)
                .stream()
                .map(row -> new PopularConcertResponse(
                        row.rank(), row.previousRank(), trend(row.rank(), row.previousRank()), row.score(),
                        row.concertId(), row.title(), row.stadiumName(),
                        fileStorageService.presignedUrl(row.posterKey())))
                .toList();
    }

    public List<PopularPhotocardResponse> popularPhotocards() {
        LocalDateTime now = LocalDateTime.now();
        return rankingRepository.findPopularPhotocards(now.minusHours(48), now.minusHours(24), now)
                .stream()
                .map(row -> new PopularPhotocardResponse(
                        row.rank(), row.previousRank(), trend(row.rank(), row.previousRank()),
                        row.tradeCount(), row.tradedAmount(), row.designId(), row.designName(), row.imageUrl(),
                        row.performanceTitle(), row.photocardId(), row.auctionId(), row.marketType()))
                .toList();
    }

    private RankTrend trend(int currentRank, Integer previousRank) {
        if (previousRank == null) return RankTrend.NEW;
        if (currentRank < previousRank) return RankTrend.UP;
        if (currentRank > previousRank) return RankTrend.DOWN;
        return RankTrend.SAME;
    }
}
