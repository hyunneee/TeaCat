ALTER TABLE areas ADD COLUMN display_order integer NOT NULL DEFAULT 0;
-- 기존 데이터는 등록 ID 순으로 복원한다. 이후 배치는 요청 배열의 명시적 순서를 저장한다.
WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY stadium_layout_id ORDER BY id) - 1 AS position
    FROM areas
)
UPDATE areas SET display_order = ranked.position FROM ranked WHERE areas.id = ranked.id;
