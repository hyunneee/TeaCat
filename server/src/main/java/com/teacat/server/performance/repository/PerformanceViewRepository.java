package com.teacat.server.performance.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class PerformanceViewRepository {

    private final JdbcClient jdbcClient;

    public boolean record(Long performanceId, UUID sessionId, LocalDateTime bucketStartedAt) {
        return jdbcClient.sql("""
                        INSERT INTO performance_views
                            (performance_general_id, session_id, bucket_started_at)
                        VALUES (:performanceId, :sessionId, :bucketStartedAt)
                        ON CONFLICT (performance_general_id, session_id, bucket_started_at) DO NOTHING
                        """)
                .param("performanceId", performanceId)
                .param("sessionId", sessionId)
                .param("bucketStartedAt", bucketStartedAt)
                .update() == 1;
    }
}
