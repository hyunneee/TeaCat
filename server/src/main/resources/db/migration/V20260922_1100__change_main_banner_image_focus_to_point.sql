-- ================================
-- 배너 크롭 위치: 아홉 칸 → 한 점(%)
-- ================================
-- 등록 화면이 "아홉 칸 중 하나 누르기" 에서 "그림을 끌어서 맞추기" 로 바뀐다.
-- 끌어서 맞추려면 값이 이어져 있어야 한다 — 아홉 칸으로는 끄는 대로 따라올 수 없고,
-- 가장 가까운 칸으로 튄다(놓는 자리와 남는 자리가 달라진다).
--
-- 값은 CSS `object-position: <x>% <y>%` 로 그대로 옮겨진다.
-- 0 = 왼쪽/위 끝, 50 = 가운데, 100 = 오른쪽/아래 끝. (client: bannerFocus.ts)

ALTER TABLE main_banners
    ADD COLUMN image_focus_x smallint NOT NULL DEFAULT 50,
    ADD COLUMN image_focus_y smallint NOT NULL DEFAULT 50;

-- 이미 골라 둔 아홉 칸을 같은 자리의 점으로 옮긴다.
-- 🔴 기본값(50, 50)으로 밀어버리면 **지금 잘 보이던 배너가 배포 순간 가운데로 틀어진다.**
UPDATE main_banners
SET image_focus_x = CASE
                        WHEN image_focus IN ('TOP_LEFT', 'LEFT', 'BOTTOM_LEFT') THEN 0
                        WHEN image_focus IN ('TOP_RIGHT', 'RIGHT', 'BOTTOM_RIGHT') THEN 100
                        ELSE 50
    END,
    image_focus_y = CASE
                        WHEN image_focus IN ('TOP_LEFT', 'TOP', 'TOP_RIGHT') THEN 0
                        WHEN image_focus IN ('BOTTOM_LEFT', 'BOTTOM', 'BOTTOM_RIGHT') THEN 100
                        ELSE 50
        END;

-- 화면이 보내는 값이라 범위를 DB 가 지킨다. 101% 는 CSS 가 조용히 잘라 쓰는데,
-- 그러면 저장된 값과 보이는 자리가 달라져 다음 사람이 원인을 못 찾는다
ALTER TABLE main_banners
    ADD CONSTRAINT chk_main_banners_image_focus_x CHECK (image_focus_x BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_main_banners_image_focus_y CHECK (image_focus_y BETWEEN 0 AND 100);

-- 🔴 아홉 칸은 **남기지 않는다.** 두 칸이 같은 것을 가리키면 어느 쪽이 진짜인지
--    다음 사람이 알 수 없고, 한쪽만 고치는 코드가 반드시 생긴다.
ALTER TABLE main_banners
    DROP COLUMN image_focus;

DROP TYPE main_banner_image_focus;
