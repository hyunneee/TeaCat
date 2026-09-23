-- 취소표 추첨의 손을 떠난 좌석을 되돌린다 (1회성 복구).
--
-- 왜 필요한가 —
--   당첨 좌석은 평범한 선점과 행 모양이 같아서(status=HELD · held_by · held_until) 예매 쪽의
--   일반 선점 해제가 그것을 풀어 버렸다. 풀린 좌석은 AVAILABLE 로 나가고, 그 뒤 추첨은
--   좌석을 되찾지 못해 FAILED('seat left the draw...') 로 끝났다 — 기다리던 사람들은
--   그 자리를 못 받았고 대기 상태 그대로 남아 있다. (2026-09-23)
--
--   원인은 이미 막았다(PerformanceSeatRepository 의 NOT EXISTS 가드). 이 스크립트는
--   막기 전에 이미 새어 나간 좌석만 정리한다. 한 번 돌리고 지워도 된다.
--
-- 무엇을 하나 —
--   ① 아직 아무도 안 가져간 좌석(AVAILABLE · held_by IS NULL)만 SOLD 로 되돌리고
--   ② 그 구역에 아직 대기자가 있으면 새 추첨(PENDING)을 만든다.
--   스위퍼가 PENDING 을 집어 체인에 커밋하고 난수·당첨까지 알아서 이어간다.
--
-- 🔴 남이 이미 잡았거나 산 좌석은 건드리지 않는다. 그 사람에게서 뺏는 것이 되고,
--    결제까지 끝났으면 환불 문제가 된다. 그런 건은 ②에서 그대로 남아 아래 확인 쿼리에
--    "회수불가" 로 보인다 — 사람이 판단할 몫이다.
--
-- 쓰는 법:
--   psql "$DATABASE_URL" -f scripts/recover-leaked-resale-seats.sql
--   (먼저 '1) 진단' 만 따로 돌려 무엇이 바뀔지 보고 나서 돌릴 것)

\set ON_ERROR_STOP on

-- ── 1) 진단 — 무엇이 샜고 무엇을 되돌릴 수 있나 ───────────────────────────
SELECT d.id                AS draw_id,
       d.draw_key,
       d.failure_reason,
       ps.status::text     AS seat_status,
       ps.held_by,
       (SELECT count(*)
          FROM resale_entries e
         WHERE e.performance_detail_id = d.performance_detail_id
           AND e.area_id = d.area_id
           AND e.status = 'WAITING')          AS waiting_count,
       CASE
           WHEN ps.status = 'AVAILABLE' AND ps.held_by IS NULL THEN '회수가능'
           ELSE '회수불가 (남이 가져감 — 사람이 판단할 것)'
       END                 AS verdict
  FROM seat_draws d
  JOIN performance_seats ps
    ON ps.performance_detail_id = d.performance_detail_id
   AND ps.seat_id = d.seat_id
 WHERE d.status = 'FAILED'
   AND d.failure_reason LIKE 'seat left the draw%'
 ORDER BY d.id;

-- ── 2) 복구 ───────────────────────────────────────────────────────────────
BEGIN;

-- 이번에 되돌릴 대상을 먼저 고정한다. 아래 두 UPDATE/INSERT 가 같은 집합을 봐야 한다
CREATE TEMP TABLE recoverable ON COMMIT DROP AS
SELECT d.id AS draw_id,
       d.performance_id,
       d.performance_detail_id,
       d.area_id,
       d.seat_id,
       d.source_ticket_order_id
  FROM seat_draws d
  JOIN performance_seats ps
    ON ps.performance_detail_id = d.performance_detail_id
   AND ps.seat_id = d.seat_id
 WHERE d.status = 'FAILED'
   AND d.failure_reason LIKE 'seat left the draw%'
   -- 아직 아무도 안 가져간 좌석만
   AND ps.status = 'AVAILABLE'
   AND ps.held_by IS NULL
   -- 그 좌석에 이미 도는 추첨이 있으면 손대지 않는다 (uq_seat_draws_active_seat)
   AND NOT EXISTS (
         SELECT 1 FROM seat_draws a
          WHERE a.performance_detail_id = d.performance_detail_id
            AND a.seat_id = d.seat_id
            AND a.status IN ('PENDING', 'OPEN', 'REVEALED'))
   -- 기다리는 사람이 있어야 다시 추첨할 의미가 있다. 없으면 AVAILABLE 이 맞는 상태다
   AND EXISTS (
         SELECT 1 FROM resale_entries e
          WHERE e.performance_detail_id = d.performance_detail_id
            AND e.area_id = d.area_id
            AND e.status = 'WAITING');

-- 좌석을 추첨의 손으로 되돌린다 (추첨이 도는 동안의 상태 = SOLD)
UPDATE performance_seats ps
   SET status = 'SOLD',
       held_by = NULL,
       held_until = NULL,
       updated_at = now()
  FROM recoverable r
 WHERE ps.performance_detail_id = r.performance_detail_id
   AND ps.seat_id = r.seat_id;

-- 새 회차를 연다. draw_no 는 그 좌석의 지금까지 최대 + 1 이어야 draw_key 가 안 겹친다
INSERT INTO seat_draws (performance_id, performance_detail_id, area_id, seat_id,
                        draw_no, draw_key, status, participant_ids, next_rank,
                        source_ticket_order_id)
SELECT r.performance_id,
       r.performance_detail_id,
       r.area_id,
       r.seat_id,
       next_no.n,
       'resale:p' || r.performance_id || ':d' || r.performance_detail_id
                  || ':s' || r.seat_id || ':n' || next_no.n,
       'PENDING'::seat_draw_status,
       -- SeatDraw.join() 과 같은 형식: id 를 쉼표로 이어 붙이고 오름차순 (체인이 순서를 검사한다)
       (SELECT string_agg(e.id::text, ',' ORDER BY e.id)
          FROM resale_entries e
         WHERE e.performance_detail_id = r.performance_detail_id
           AND e.area_id = r.area_id
           AND e.status = 'WAITING'),
       0,
       r.source_ticket_order_id
  FROM recoverable r
  CROSS JOIN LATERAL (
       SELECT coalesce(max(d2.draw_no), 0) + 1 AS n
         FROM seat_draws d2
        WHERE d2.performance_detail_id = r.performance_detail_id
          AND d2.seat_id = r.seat_id) AS next_no;

-- 무엇을 되돌렸는지 남긴다. 예전 행의 사유를 덮어쓰지 않고 덧붙인다
UPDATE seat_draws d
   SET failure_reason = left(d.failure_reason || ' (복구: 좌석 회수 후 재추첨)', 200)
  FROM recoverable r
 WHERE d.id = r.draw_id;

COMMIT;

-- ── 3) 확인 ───────────────────────────────────────────────────────────────
-- 새로 열린 추첨. 스위퍼가 곧 체인에 커밋한다 (booking.resale.sweep-interval)
SELECT id, draw_key, status, participant_ids, created_at
  FROM seat_draws
 WHERE status = 'PENDING'
 ORDER BY id DESC
 LIMIT 20;
