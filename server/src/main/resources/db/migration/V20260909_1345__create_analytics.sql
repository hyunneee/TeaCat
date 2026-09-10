-- ================================
-- 운영 통계 (어드민 대시보드)
-- ================================
-- 가입·탈퇴는 users.created_at / deleted_at 으로 소급 집계가 되지만,
-- **접속 기록은 남긴 적이 없어 소급이 안 된다.** 이 마이그레이션이 적용된
-- 시점부터 쌓인다.

-- ────────────────────────────────────────────────────────────
-- 하루 접속자
-- ────────────────────────────────────────────────────────────
-- "한 사람당 하루에 한 번" 이 요구사항이라 (user_id, visit_date) 가 곧 한 행이다.
-- 요청마다 세는 게 아니므로 방문 횟수·경로는 담지 않는다. 그런 게 필요해지면
-- 그건 이 테이블이 아니라 접근 로그다.
--
-- 기록 시점은 로그인이 아니라 **인증된 요청**이다. 액세스 토큰 1시간 + 리프레시 14일이라
-- 자동 로그인 사용자는 며칠씩 로그인 API 를 타지 않는다. 로그인만 세면 통째로 빠진다.
--
-- 운영진 계정도 행은 쌓이지만 집계에서는 role = 'USER' 만 센다.
-- 서비스 지표에 우리 팀 접속이 섞이면 안 된다.
CREATE TABLE daily_active_users
(
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    bigint    NOT NULL,
    visit_date date      NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),

    CONSTRAINT fk_daily_active_users_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    -- 하루 한 행. Redis 가 비어도(재시작·flush) 이 제약이 중복을 막는다
    CONSTRAINT uq_daily_active_users_user_date
        UNIQUE (user_id, visit_date)
);

-- 날짜 구간 집계 (일자별 접속자 수)
CREATE INDEX idx_daily_active_users_visit_date
    ON daily_active_users (visit_date);

-- ────────────────────────────────────────────────────────────
-- 배포 이력 (차트의 세로 마커선)
-- ────────────────────────────────────────────────────────────
-- "어떤 기능이 사람을 끌어들였나" 를 보기 위한 것이다. 젠킨스가 배포 성공 직후
-- 넣는다 (Jenkinsfile 의 post.success).
--
-- 🔴 운영(master) 배포만 기록한다. dev 는 하루에도 여러 번 나가서 마커가 빽빽해지면
--    차트가 읽히지 않는다. 그래도 environment 컬럼을 둔 건 나중에 dev 를 켜더라도
--    조회에서 걸러낼 수 있게 하기 위해서다.
--
-- 🔴 이건 상관관계지 인과가 아니다. 마커 옆에서 그래프가 올라갔다고 그 배포가
--    올린 것은 아니다 — 같은 날 홍보를 했을 수도 있다.
CREATE TABLE deployments
(
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- 'prod' | 'dev'. 지금 들어오는 건 prod 뿐이다
    environment  varchar(10)  NOT NULL,
    branch       varchar(100) NOT NULL,
    commit_hash  varchar(40)  NOT NULL,
    -- 커밋 제목 한 줄 (git log -1 --pretty=%s). 마커 툴팁에 그대로 뜬다
    summary      varchar(200),
    build_number int,
    deployed_at  timestamp    NOT NULL,
    created_at   timestamp    NOT NULL DEFAULT now(),

    -- 같은 커밋을 다시 배포해도(젠킨스 재실행) 마커는 하나다.
    -- 코드가 같은 지점이므로 점을 두 개 찍을 이유가 없고, 덕분에 기록 API 가 멱등해진다
    CONSTRAINT uq_deployments_env_commit
        UNIQUE (environment, commit_hash)
);

CREATE INDEX idx_deployments_deployed_at
    ON deployments (deployed_at);
