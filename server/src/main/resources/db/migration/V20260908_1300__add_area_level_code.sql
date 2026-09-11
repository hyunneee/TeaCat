ALTER TABLE areas
    ADD COLUMN level_code varchar(20);

UPDATE areas
   SET level_code = '1F'
 WHERE level_code IS NULL;

ALTER TABLE areas
    ALTER COLUMN level_code SET NOT NULL,
    ALTER COLUMN level_code SET DEFAULT '1F',
    DROP CONSTRAINT uq_areas_layout_area_code,
    ADD CONSTRAINT uq_areas_layout_level_area_code
        UNIQUE (stadium_layout_id, level_code, area_code);

CREATE INDEX idx_areas_layout_level
    ON areas (stadium_layout_id, level_code);
