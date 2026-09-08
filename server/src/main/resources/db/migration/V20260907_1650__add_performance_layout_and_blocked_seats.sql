ALTER TABLE performance_general
    ADD COLUMN stadium_layout_id bigint,
    ADD COLUMN layout_elements jsonb NOT NULL
        DEFAULT '{"elements":[],"blockedSeatIds":[]}'::jsonb;

UPDATE performance_general pg
   SET stadium_layout_id = sl.id
  FROM stadium_layouts sl
 WHERE sl.stadium_id = pg.stadium_id
   AND sl.is_default;

ALTER TABLE performance_general
    ALTER COLUMN stadium_layout_id SET NOT NULL,
    ADD CONSTRAINT fk_performance_general_stadium_layout
        FOREIGN KEY (stadium_layout_id) REFERENCES stadium_layouts (id),
    ADD CONSTRAINT chk_performance_layout_elements_object
        CHECK (jsonb_typeof(layout_elements) = 'object');

CREATE INDEX idx_performance_general_stadium_layout_id
    ON performance_general (stadium_layout_id);

ALTER TYPE seat_booking_status ADD VALUE IF NOT EXISTS 'BLOCKED';
