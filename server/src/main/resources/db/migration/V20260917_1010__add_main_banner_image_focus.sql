-- ================================
-- 배너 이미지에서 보여줄 부분 (크롭 위치)
-- ================================

-- 배너 틀은 폰에서 4:3, 데스크톱에서 2:1 이다. 올린 그림의 비율이 다르면
-- object-cover 가 가운데만 남기고 잘라내는데, 그 가운데에 정작 봐야 할 것이
-- 없을 때가 있다 (얼굴이 위쪽에 있는 3:4 포스터가 대표적이다).
-- 어디를 남길지는 그림마다 다르므로 관리자가 고른다.
--
-- 값은 CSS `object-position` 으로 그대로 옮겨진다 (client: bannerFocus.ts).
CREATE TYPE main_banner_image_focus AS ENUM (
    'TOP_LEFT', 'TOP', 'TOP_RIGHT',
    'LEFT', 'CENTER', 'RIGHT',
    'BOTTOM_LEFT', 'BOTTOM', 'BOTTOM_RIGHT'
    );

-- 공연 배너(포스터)에도 걸린다. 3:4 포스터를 2:1 로 자를 때가 가장 많이 잘린다.
-- 기존 행은 지금 보이는 그대로(가운데) 두어야 화면이 갑자기 바뀌지 않는다
ALTER TABLE main_banners
    ADD COLUMN image_focus main_banner_image_focus NOT NULL DEFAULT 'CENTER';
