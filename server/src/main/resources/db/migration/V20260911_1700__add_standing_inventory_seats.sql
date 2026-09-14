-- 스탠딩도 기존 좌석 선점·결제 파이프라인을 사용하도록 위치 없는 가상 좌석을 만든다.
-- seat_number는 사용자가 고르는 위치 번호가 아니라 구역 안의 재고 단위 식별자다.
INSERT INTO seats (area_id, seat_x, seat_y, row_label, seat_number)
SELECT a.id, NULL, NULL, 'STANDING', inventory.number
FROM areas a
CROSS JOIN LATERAL generate_series(1, a.max_seat) AS inventory(number)
WHERE a.type = 'STANDING'
  AND NOT EXISTS (
      SELECT 1
      FROM seats existing
      WHERE existing.area_id = a.id
        AND existing.row_label = 'STANDING'
        AND existing.seat_number = inventory.number
  );
