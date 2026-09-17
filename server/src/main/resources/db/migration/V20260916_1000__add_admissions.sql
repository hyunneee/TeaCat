-- ================================
-- 현장 검표 — 입장 기록 (GATE_PLAN.md 4-2)
-- ================================
-- 공연장 입구에서 얼굴로 티켓 주인을 찾아 들여보낸 기록이다.
--
-- 🔴 ticket_status 에 ENTERED 를 더하지 않는다. TicketStatus 는 "예매 자체의 상태" 이고
--    (CONFIRMED / CANCELLED) 입장은 예매 상태가 아니다. 값을 더하면
--      1. status 로 거르는 기존 쿼리가 전부 영향을 받는다
--         (1인 N매 검사 · countSoldByArea · 내 티켓 목록 …)
--      2. 상태가 하나뿐이라 "입장한 뒤 취소" 를 표현할 수 없다 — 취소가 입장을 덮는다
--      3. 입장 시각 · 통과시킨 직원 · 판정 방식을 남길 자리가 없다
--
-- 🔴 유사도 점수는 남기지 않는다. 생체 판정 점수라 보관할 값이 아니다
--    (client 의 useFaceVerify 가 GA 에 점수를 안 보내는 것과 같은 이유).
--    남기는 건 누가 · 언제 · 어떤 방식으로 통과시켰는가뿐이다.

CREATE TYPE admission_method AS ENUM ('FACE', 'MANUAL');

CREATE TABLE admissions
(
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id   bigint           NOT NULL,
    admitted_at timestamp        NOT NULL DEFAULT now(),
    -- 통과시킨 운영자. 수동 통과(MANUAL)의 책임 소재이자, 오인 입장을 되짚는 실마리다
    admitted_by bigint           NOT NULL,
    method      admission_method NOT NULL,

    CONSTRAINT fk_admissions_ticket
        FOREIGN KEY (ticket_id) REFERENCES tickets (id),
    CONSTRAINT fk_admissions_admitted_by
        FOREIGN KEY (admitted_by) REFERENCES users (id),

    -- 🔴 중복 입장을 막는 유일한 근거다.
    --    서비스의 existsByTicketId 선검사는 **동시 요청에서 뚫린다** — 게이트를 두 대
    --    운영하면 같은 티켓이 두 기기에 동시에 들어올 수 있고, 두 트랜잭션이 나란히
    --    "아직 없음" 을 읽는다. 앱 검사는 친절한 에러 메시지를 위해서만 두고
    --    보장은 여기가 한다 (GateAdmissionService 가 위반을 GATE_002 로 번역한다).
    CONSTRAINT uq_admissions_ticket UNIQUE (ticket_id)
);

-- 회차별 입장 현황(GET /admin/gate/performance-details/{id})이 티켓과 조인해 센다.
-- ticket_id 의 UNIQUE 인덱스가 그 조인을 받치므로 따로 만들지 않는다.
--
-- 후보 검색(POST …/verify)은 tickets 를 performance_detail_id 로 거르는데, 그쪽은
-- UNIQUE (performance_detail_id, seat_id) 의 앞자리를 쓴다. 역시 새 인덱스가 필요 없다.
--
-- 🔴 face_embedding 에 벡터 인덱스(HNSW)를 만들지 않는다. HNSW 는 **근사 검색**이라
--    1등을 놓칠 수 있고, 입장 통제에서 "가끔 본인을 못 찾는다" 는 받아들일 수 없다.
--    회차로 걸러진 뒤의 정확 검색으로 시작하고, 실측해서 느리면 그때 다시 본다.
