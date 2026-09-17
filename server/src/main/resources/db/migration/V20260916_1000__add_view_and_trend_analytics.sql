-- Public detail views are deduplicated in 30-minute buckets. Existing cards start at zero.
ALTER TABLE nft_photocards
    ADD COLUMN view_count bigint NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_nft_photocards_view_count CHECK (view_count >= 0);

CREATE TABLE nft_photocard_views
(
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    photocard_id      bigint    NOT NULL,
    session_id        uuid      NOT NULL,
    bucket_started_at timestamp NOT NULL,
    viewed_at         timestamp NOT NULL DEFAULT now(),

    CONSTRAINT fk_nft_photocard_views_photocard
        FOREIGN KEY (photocard_id) REFERENCES nft_photocards (id) ON DELETE CASCADE,
    CONSTRAINT uq_nft_photocard_views_bucket
        UNIQUE (photocard_id, session_id, bucket_started_at)
);

CREATE INDEX idx_nft_photocards_view_count
    ON nft_photocards (view_count DESC, id DESC);
CREATE INDEX idx_nft_photocard_views_viewed_at
    ON nft_photocard_views (viewed_at DESC);
