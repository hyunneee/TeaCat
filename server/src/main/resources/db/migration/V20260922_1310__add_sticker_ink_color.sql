-- 사용자가 고른 잉크 색을 작업에 남긴다.
--
-- 🔴 이게 없으면 결과 색이 바랜다. 워커에 색을 **이름으로** 주면 모델이 선명하게 칠하는데,
--    안 주면 "낙서에서 색을 가져와라" 로 떨어지고 얇은 선화에서는 신호가 약해 회색빛이 된다.
--    2026-09-21 실측: 같은 파란 선 고양이가 색 지정 없이는 연한 세이지, 'blue' 를 주면 선명한
--    파랑, 'pink' 를 주면 선명한 분홍으로 나왔다. 프롬프트 문구로는 다섯 판을 고쳐도 안 됐다.
--
-- hex 로 받는 이유: 프론트의 INK_PALETTE 가 hex 이고, `+` 로 추가한 색은 팔레트에 없는 값이다.
-- 워커에 넘길 때 서버가 가장 가까운 색 이름으로 바꾼다 (StickerInkColor).
ALTER TABLE sticker_jobs
    ADD COLUMN ink_color VARCHAR(7);

COMMENT ON COLUMN sticker_jobs.ink_color IS
    '사용자가 고른 잉크 색 (#RRGGBB). 검정·회색이면 색을 안 고른 것으로 보고 NULL 로 둔다';
