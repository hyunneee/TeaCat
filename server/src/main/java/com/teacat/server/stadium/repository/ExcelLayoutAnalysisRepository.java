package com.teacat.server.stadium.repository;

import com.teacat.server.stadium.dto.response.ExcelAnalysisResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class ExcelLayoutAnalysisRepository {

    private static final String KEY_PREFIX = "stadium:layout-import:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public void save(ExcelAnalysisResponse analysis, Duration ttl) {
        redisTemplate.opsForValue().set(key(analysis.analysisId()),
                objectMapper.writeValueAsString(analysis), ttl);
    }

    public Optional<ExcelAnalysisResponse> find(String analysisId) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(key(analysisId)))
                .map(json -> objectMapper.readValue(json, ExcelAnalysisResponse.class));
    }

    public void delete(String analysisId) {
        redisTemplate.delete(key(analysisId));
    }

    private String key(String analysisId) {
        return KEY_PREFIX + analysisId;
    }
}
