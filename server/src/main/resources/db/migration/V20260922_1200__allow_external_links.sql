-- ================================
-- 바로가기 주소 — 서비스 밖으로도 보낼 수 있게
-- ================================
-- 배너 링크는 지금까지 '/' 로 시작하는 서비스 내 경로만 받았다. 공식 홈페이지·예매처
-- 공지처럼 바깥으로 보내야 할 자리가 생겨서 http(s) 주소도 받는다.
--
-- 🔴 받는 것은 **서비스 내 경로와 http(s) 뿐**이다. `javascript:` · `data:` 는 거절한다 —
--    그대로 href 에 실리면 우리 페이지 안에서 그 코드가 돈다. 규칙은 요청 DTO 의
--    @Pattern 과 client 의 shared/lib/link.ts 에 같은 식으로 적혀 있다.

-- 외부 주소는 경로보다 훨씬 길다(쿼리스트링·추적 파라미터). 255 로는 잘린다
ALTER TABLE main_banners
    ALTER COLUMN link_path TYPE varchar(500);

-- 🔴 컬럼만 넓히면 안 된다. V20260909_1030 이 "내부 경로만" 으로 걸어 둔 CHECK 가 그대로
--    남아 있어서, 화면과 서버 @Pattern 을 통과한 외부 주소가 INSERT 에서 거절된다
--    (관리자에게는 저장 누르면 500 으로 보인다). 실제로 로컬에서 밟고 고쳤다.
ALTER TABLE main_banners
    DROP CONSTRAINT chk_main_banners_link_path;

-- 앱의 규칙과 같은 것을 DB 에도 남긴다 — 마지막 방어선이다.
-- Postgres 정규식에는 전방탐색(?!)이 없어서 "슬래시 하나로 시작" 을 `[^/]` 로 쓴다.
--   /            내부 최상위 경로 (뒤가 비어도 된다)
--   /nft/draw    내부 경로
--   https://…    외부 주소
--   //evil.com   거절 (경로처럼 보이지만 바깥으로 나간다)
--   javascript:… 거절 (href 에 실리면 우리 페이지 안에서 코드가 돈다)
ALTER TABLE main_banners
    ADD CONSTRAINT chk_main_banners_link_path
        CHECK (link_path IS NULL
            OR link_path ~ '^(/([^/]\S*)?|https?://\S+)$');

-- ── 공연 바로가기 ──────────────────────────────────────────
-- 공연 상세에서 오른쪽 아래에 뜨는 버튼 하나. 공식 사이트·아티스트 채널처럼
-- 우리가 담지 않는 정보로 보낸다. 비어 있으면 버튼 자체가 없다.
--
-- 예매 조건이 아니라서 티켓팅이 시작된 뒤에도 고칠 수 있다 (공연장·티켓팅 시각과 다르다).
ALTER TABLE performance_general
    ADD COLUMN link_url varchar(500);

-- 배너와 같은 규칙을 여기에도 건다. 화면·서버 @Pattern 이 이미 막지만, 셋 중 하나가
-- 느슨해져도 DB 가 남는다 — 이 제약이 없었으면 위의 배너 버그를 배포 뒤에 알았다.
ALTER TABLE performance_general
    ADD CONSTRAINT chk_performance_general_link_url
        CHECK (link_url IS NULL
            OR link_url ~ '^(/([^/]\S*)?|https?://\S+)$');
