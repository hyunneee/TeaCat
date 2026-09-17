package com.teacat.server.search.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;

@Repository
@RequiredArgsConstructor
public class SearchTrendCacheRepository {

    private static final Duration TTL = Duration.ofHours(48);
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("yyyyMMddHH");
    private final StringRedisTemplate redisTemplate;

    public boolean incrementOnce(LocalDateTime bucket, String sessionId,
                                 String normalizedKeyword, String displayKeyword) {
        String suffix = HOUR.format(bucket);
        String dedupeKey = "search:dedupe:" + suffix + ":" + sessionId + ":" + normalizedKeyword;
        Boolean first = redisTemplate.opsForValue().setIfAbsent(dedupeKey, "1", TTL);
        if (!Boolean.TRUE.equals(first)) return false;

        String countKey = "search:hour:" + suffix + ":counts";
        String displayKey = "search:hour:" + suffix + ":display";
        redisTemplate.opsForZSet().incrementScore(countKey, normalizedKeyword, 1);
        redisTemplate.opsForHash().putIfAbsent(displayKey, normalizedKeyword, displayKeyword);
        redisTemplate.expire(countKey, TTL);
        redisTemplate.expire(displayKey, TTL);
        return true;
    }

    public List<CountedKeyword> topTen(LocalDateTime bucket) {
        String suffix = HOUR.format(bucket);
        String countKey = "search:hour:" + suffix + ":counts";
        String displayKey = "search:hour:" + suffix + ":display";
        Set<ZSetOperations.TypedTuple<String>> tuples =
                redisTemplate.opsForZSet().reverseRangeWithScores(countKey, 0, 9);
        if (tuples == null) return List.of();
        return tuples.stream().map(tuple -> {
            String normalized = tuple.getValue();
            Object display = redisTemplate.opsForHash().get(displayKey, normalized);
            return new CountedKeyword(normalized,
                    display == null ? normalized : display.toString(),
                    tuple.getScore() == null ? 0 : tuple.getScore().longValue());
        }).toList();
    }

    public record CountedKeyword(String normalizedKeyword, String displayKeyword, long count) {
    }
}
