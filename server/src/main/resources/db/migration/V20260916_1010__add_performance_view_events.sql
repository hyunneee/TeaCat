CREATE TABLE performance_views
(
    id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    performance_general_id bigint    NOT NULL,
    session_id             uuid      NOT NULL,
    bucket_started_at      timestamp NOT NULL,
    viewed_at              timestamp NOT NULL DEFAULT now(),

    CONSTRAINT fk_performance_views_performance
        FOREIGN KEY (performance_general_id) REFERENCES performance_general (id) ON DELETE CASCADE,
    CONSTRAINT uq_performance_views_bucket
        UNIQUE (performance_general_id, session_id, bucket_started_at)
);

CREATE INDEX idx_performance_views_rank_window
    ON performance_views (viewed_at DESC, performance_general_id);
