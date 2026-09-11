-- ================================
-- 도안: 템플릿에서 만들어지고, 공연에 묶일 수 있다
-- ================================
-- 지금까지 도안은 "공연 도안" 이거나 "뽑기 풀" 이거나 둘 중 하나였다. 공연별 뽑기 풀은
-- 둘 다여야 한다 — 뽑기로 나오면서 그 공연에만 속한다.
--
--   draw_pool=true  · 공연 있음  → 그 공연의 뽑기 풀 도안              ← 이번에 허용
--   draw_pool=true  · 공연 NULL  → 이벤트 팩이 뽑는 풀
--   draw_pool=false · 공연 있음  → 공연 전용 도안 (자동 발급용, 지금 꺼져 있다)
--   draw_pool=false · 공연 NULL  → 없음 (금지)

ALTER TABLE nft_photocard_designs
    DROP CONSTRAINT chk_nft_photocard_designs_pool,
    -- 공연 도안이 아니면 반드시 뽑기 풀이다. 뽑기 풀은 공연에 묶일 수도(그 공연 전용),
    -- 안 묶일 수도(이벤트 팩이 뽑는 풀) 있다
    ADD CONSTRAINT chk_nft_photocard_designs_pool
        CHECK (draw_pool OR performance_general_id IS NOT NULL);

-- chk_nft_photocard_designs_pool_attrs 는 그대로 둔다 ("뽑기 풀이면 group_name·grade 가 있어야 한다").
-- 템플릿이 소속과 등급을 반드시 갖고, 도안이 그것을 물려받으므로 이 제약은 자동으로 만족된다

-- 어느 템플릿에서 만들어졌나. 템플릿 없이 직접 등록된 기존 도안은 NULL.
ALTER TABLE nft_photocard_designs
    ADD COLUMN template_id bigint REFERENCES nft_photocard_templates (id);

-- 같은 템플릿을 같은 곳에 두 번 넣지 않는다.
-- 🔴 COALESCE 인 이유: 이벤트 풀은 performance_general_id 가 NULL 이고 PostgreSQL 의 UNIQUE 는
--    NULL 을 서로 다른 값으로 본다. 그냥 두면 이벤트 풀에 같은 템플릿이 여러 번 들어간다
CREATE UNIQUE INDEX uq_nft_photocard_designs_template
    ON nft_photocard_designs (COALESCE(performance_general_id, 0), template_id)
    WHERE template_id IS NOT NULL;

-- 뽑기가 공연으로 좁혀 후보를 고른다. 기존 idx_nft_photocard_designs_draw_pool 은
-- 공연을 모르므로 그대로 두고 따로 판다
CREATE INDEX idx_nft_photocard_designs_draw_pool_performance
    ON nft_photocard_designs (performance_general_id, id)
    WHERE draw_pool AND chain_status = 'REGISTERED';
