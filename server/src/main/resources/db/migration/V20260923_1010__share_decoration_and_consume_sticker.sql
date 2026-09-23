-- ================================
-- 포카 꾸미기 — ① 꾸밈이 카드를 따라간다 ② 스티커는 붙이면 못 뗀다 ③ 초과분은 유료
-- ================================
--
-- 2026-09-22 에 만든 규칙을 2026-09-23 에 뒤집는다. 무엇이 왜 바뀌는지 남긴다.

-- ── ① 꾸밈의 주인이 "사람" 에서 "카드" 로 바뀐다 ───────────────────────────
--
-- 어제: 꾸밈은 만든 사람 것이고, 카드가 팔리면 판 사람의 꾸밈을 지웠다.
--       조회를 (카드, 사람) 두 칸으로 해서 새 주인에게 안 보이게 했다.
-- 오늘: 꾸밈은 **카드의 일부**다. 마켓에도 꾸민 모습이 보이고, 사는 사람이 **그대로 받는다.**
--       보이는 것과 받는 것이 같아야 속지 않는다.
--
-- 🔴 그래서 UNIQUE 가 다시 한 칸이 된다. 어제 두 칸으로 바꾼 이유("새 주인이 못 꾸민다")는
--    이제 성립하지 않는다 — 새 주인이 꾸밈을 **물려받으므로** 덮어쓰면 된다.
--
-- ⚠️ 한 카드에 여러 사람의 꾸밈이 이미 있으면 이 제약이 실패한다. 기능이 배포된 적이 없어
--    실제 데이터는 없지만, 실패하면 **조용히 넘어가지 않고 마이그레이션이 멈춘다** — 그게 맞다.
ALTER TABLE photocard_decorations
    DROP CONSTRAINT uq_photocard_decorations_card_user;

ALTER TABLE photocard_decorations
    ADD CONSTRAINT uq_photocard_decorations_card UNIQUE (photocard_id);

-- user_id 는 이제 **접근 열쇠가 아니라 "누가 만들었나" 기록**이다.
-- 고칠 권한은 만든 사람이 아니라 **현재 카드 주인**에게 있다.
COMMENT ON COLUMN photocard_decorations.user_id IS
    '이 꾸밈을 만든 사람. 접근 제어에 쓰지 말 것 — 고칠 권한은 현재 카드 소유자에게 있다';

-- ── ② 스티커는 붙이면 못 뗀다 ────────────────────────────────────────────
--
-- 꾸미는 중에는 옮기고 빼고 자유지만, **"완료하기" 를 누르는 순간 소모가 확정**되고
-- 그 배치는 잠긴다. 다시 들어와도 잠긴 것은 못 건드리고 새 스티커만 얹을 수 있다.
--
-- 🔴 카드가 팔리면 스티커도 카드를 따라간다. 판 사람에게 돌아오지 않는다.
ALTER TABLE stickers
    ADD COLUMN used_at           TIMESTAMPTZ,
    ADD COLUMN used_photocard_id BIGINT;

ALTER TABLE stickers
    ADD CONSTRAINT fk_stickers_used_photocard
        FOREIGN KEY (used_photocard_id) REFERENCES nft_photocards (id);

-- 꾸미기 서랍은 "아직 안 쓴 것" 만 보여준다. 그 조회가 이 인덱스를 탄다
CREATE INDEX idx_stickers_unused ON stickers (user_id) WHERE used_at IS NULL AND deleted_at IS NULL;

COMMENT ON COLUMN stickers.used_at IS
    '꾸미기 완료로 소모된 시각. NULL 이면 아직 안 썼다 — 되돌릴 수 없다';

-- ── ③ 하루 몫을 넘겨 만든 건은 유료다 ─────────────────────────────────────
--
-- 하루 5장까지 공짜, 그 뒤 1장당 100 캣머니.
-- 🔴 실패한 생성은 **돈을 돌려줘야 한다.** 무엇을 돌려줄지 알려면 얼마를 받았는지 남아야 한다.
--    (지금도 실패한 건은 하루 몫에서 안 깎는다. 같은 원칙이다)
ALTER TABLE sticker_jobs
    ADD COLUMN paid_cat INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN sticker_jobs.paid_cat IS
    '이 건을 만들며 태운 캣머니. 0 이면 하루 무료 몫으로 만든 것. 실패 시 이 금액을 돌려준다';
