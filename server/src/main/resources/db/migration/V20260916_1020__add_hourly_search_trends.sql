-- Search events are accumulated in Redis; only the hourly Top 10 is persisted.
CREATE TABLE search_keyword_hourly
(
    bucket_started_at  timestamp    NOT NULL,
    rank               smallint     NOT NULL,
    normalized_keyword varchar(100) NOT NULL,
    display_keyword    varchar(100) NOT NULL,
    search_count       bigint       NOT NULL,
    created_at         timestamp    NOT NULL DEFAULT now(),

    PRIMARY KEY (bucket_started_at, rank),
    CONSTRAINT uq_search_keyword_hourly_keyword
        UNIQUE (bucket_started_at, normalized_keyword),
    CONSTRAINT chk_search_keyword_hourly_rank CHECK (rank BETWEEN 1 AND 10),
    CONSTRAINT chk_search_keyword_hourly_count CHECK (search_count > 0)
);

CREATE INDEX idx_search_keyword_hourly_latest
    ON search_keyword_hourly (bucket_started_at DESC, rank);
