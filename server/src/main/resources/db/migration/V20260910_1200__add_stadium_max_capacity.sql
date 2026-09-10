ALTER TABLE stadiums
    ADD COLUMN max_capacity int;

UPDATE stadiums s
   SET max_capacity = GREATEST(
       1,
       COALESCE((
           SELECT MAX(layout_capacity)
             FROM (
                 SELECT COUNT(se.id) FILTER (WHERE a.type = 'SEATED')
                        + COALESCE(SUM(a.max_seat) FILTER (WHERE a.type = 'STANDING'), 0)
                          AS layout_capacity
                   FROM stadium_layouts sl
                   LEFT JOIN areas a ON a.stadium_layout_id = sl.id
                   LEFT JOIN seats se ON se.area_id = a.id
                  WHERE sl.stadium_id = s.id
                  GROUP BY sl.id
             ) capacities
       ), 0)
   );

ALTER TABLE stadiums
    ALTER COLUMN max_capacity SET NOT NULL,
    ADD CONSTRAINT chk_stadiums_max_capacity_positive CHECK (max_capacity > 0);
