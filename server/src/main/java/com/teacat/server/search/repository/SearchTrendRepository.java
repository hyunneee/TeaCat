package com.teacat.server.search.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class SearchTrendRepository {

    private static final long SNAPSHOT_LOCK_ID = 7_402_016L;
    private final JdbcClient jdbcClient;

    /** 여러 서버 인스턴스 중 한 곳만 같은 시각의 스냅샷을 저장한다. 트랜잭션 종료 시 자동 해제된다. */
    public boolean trySnapshotLock() {
        return Boolean.TRUE.equals(jdbcClient.sql("SELECT pg_try_advisory_xact_lock(:lockId)")
                .param("lockId", SNAPSHOT_LOCK_ID)
                .query(Boolean.class)
                .single());
    }

    public void replace(LocalDateTime bucket, List<Snapshot> items) {
        jdbcClient.sql("DELETE FROM search_keyword_hourly WHERE bucket_started_at = :bucket")
                .param("bucket", bucket).update();
        for (Snapshot item : items) {
            jdbcClient.sql("""
                    INSERT INTO search_keyword_hourly
                        (bucket_started_at, rank, normalized_keyword, display_keyword, search_count)
                    VALUES (:bucket, :rank, :normalized, :display, :count)
                    """)
                    .param("bucket", bucket)
                    .param("rank", item.rank())
                    .param("normalized", item.normalizedKeyword())
                    .param("display", item.displayKeyword())
                    .param("count", item.count())
                    .update();
        }
    }

    public Optional<LocalDateTime> latestBucket() {
        return jdbcClient.sql("SELECT max(bucket_started_at) FROM search_keyword_hourly")
                .query(LocalDateTime.class).optional();
    }

    public List<Snapshot> findByBucket(LocalDateTime bucket) {
        return jdbcClient.sql("""
                SELECT rank, normalized_keyword, display_keyword, search_count
                  FROM search_keyword_hourly
                 WHERE bucket_started_at = :bucket
                 ORDER BY rank
                """)
                .param("bucket", bucket)
                .query((rs, rowNum) -> new Snapshot(
                        rs.getInt("rank"), rs.getString("normalized_keyword"),
                        rs.getString("display_keyword"), rs.getLong("search_count")))
                .list();
    }

    public record Snapshot(int rank, String normalizedKeyword, String displayKeyword, long count) {
    }
}
