ALTER TABLE stadiums
    ADD COLUMN manager_id bigint,
    ADD COLUMN layout_image_key varchar(500),
    ADD COLUMN layout_width int,
    ADD COLUMN layout_height int,
    ADD CONSTRAINT fk_stadiums_manager
        FOREIGN KEY (manager_id) REFERENCES users (id),
    ADD CONSTRAINT chk_stadiums_layout_dimensions
        CHECK (
            (layout_width IS NULL AND layout_height IS NULL)
            OR (layout_width > 0 AND layout_height > 0)
        ),
    ADD CONSTRAINT chk_stadiums_layout_image_dimensions
        CHECK (layout_image_key IS NULL OR (layout_width IS NOT NULL AND layout_height IS NOT NULL));

CREATE INDEX idx_stadiums_manager_id ON stadiums (manager_id);

ALTER TABLE areas
    ALTER COLUMN max_seat SET NOT NULL;

ALTER TABLE areas
    DROP CONSTRAINT uq_areas_stadium_zone_arrangement;

ALTER TABLE areas
    ADD CONSTRAINT chk_areas_max_seat_positive CHECK (max_seat > 0),
    ADD CONSTRAINT chk_areas_position_non_negative
        CHECK ((area_x IS NULL OR area_x >= 0) AND (area_y IS NULL OR area_y >= 0)),
    ADD CONSTRAINT chk_areas_size_positive
        CHECK ((height IS NULL OR height > 0) AND (width IS NULL OR width > 0)),
    ADD CONSTRAINT chk_areas_layout_complete
        CHECK (
            (area_x IS NULL AND area_y IS NULL AND width IS NULL AND height IS NULL)
            OR (area_x IS NOT NULL AND area_y IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL)
        );

ALTER TABLE seats
    ADD CONSTRAINT chk_seats_number_positive CHECK (seat_number > 0),
    ADD CONSTRAINT chk_seats_position_non_negative
        CHECK ((seat_x IS NULL OR seat_x >= 0) AND (seat_y IS NULL OR seat_y >= 0)),
    ADD CONSTRAINT chk_seats_layout_complete
        CHECK (
            (seat_x IS NULL AND seat_y IS NULL)
            OR (seat_x IS NOT NULL AND seat_y IS NOT NULL)
        );

CREATE TYPE stadium_layout_status AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE stadium_layouts
(
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stadium_id      bigint                 NOT NULL,
    name            varchar(100)           NOT NULL,
    image_key       varchar(500),
    width           int                    NOT NULL,
    height          int                    NOT NULL,
    layout_elements jsonb                  NOT NULL DEFAULT '[]'::jsonb,
    is_default      boolean                NOT NULL DEFAULT false,
    status          stadium_layout_status  NOT NULL DEFAULT 'DRAFT',
    created_at      timestamp              NOT NULL DEFAULT now(),
    updated_at      timestamp              NOT NULL DEFAULT now(),

    CONSTRAINT fk_stadium_layouts_stadium
        FOREIGN KEY (stadium_id) REFERENCES stadiums (id),
    CONSTRAINT uq_stadium_layouts_stadium_name
        UNIQUE (stadium_id, name),
    CONSTRAINT chk_stadium_layouts_dimensions
        CHECK (width > 0 AND height > 0),
    CONSTRAINT chk_stadium_layouts_elements_array
        CHECK (jsonb_typeof(layout_elements) = 'array')
);

CREATE INDEX idx_stadium_layouts_stadium_id ON stadium_layouts (stadium_id);
CREATE UNIQUE INDEX uq_stadium_layouts_default
    ON stadium_layouts (stadium_id) WHERE is_default;

-- 기존 단일 좌석표 데이터는 공연장별 기본 배치 한 건으로 안전하게 이관한다.
INSERT INTO stadium_layouts
    (stadium_id, name, image_key, width, height, is_default, status)
SELECT s.id,
       '기본 배치',
       s.layout_image_key,
       GREATEST(
           COALESCE(s.layout_width, 0),
           COALESCE(CEIL(MAX(a.area_x + a.width))::int, 0),
           COALESCE(CEIL(MAX(se.seat_x))::int + 1, 0),
           1
       ),
       GREATEST(
           COALESCE(s.layout_height, 0),
           COALESCE(CEIL(MAX(a.area_y + a.height))::int, 0),
           COALESCE(CEIL(MAX(se.seat_y))::int + 1, 0),
           1
       ),
       true,
       'ACTIVE'::stadium_layout_status
  FROM stadiums s
  LEFT JOIN areas a ON a.stadium_id = s.id
  LEFT JOIN seats se ON se.area_id = a.id
 GROUP BY s.id, s.layout_image_key, s.layout_width, s.layout_height;

ALTER TABLE areas ADD COLUMN stadium_layout_id bigint;

UPDATE areas a
   SET stadium_layout_id = sl.id
  FROM stadium_layouts sl
 WHERE sl.stadium_id = a.stadium_id
   AND sl.is_default;

ALTER TABLE areas
    ALTER COLUMN stadium_layout_id SET NOT NULL,
    ADD CONSTRAINT fk_areas_stadium_layout
        FOREIGN KEY (stadium_layout_id) REFERENCES stadium_layouts (id),
    ADD CONSTRAINT uq_areas_layout_area_code UNIQUE (stadium_layout_id, area_code);

CREATE INDEX idx_areas_stadium_layout_id ON areas (stadium_layout_id);
