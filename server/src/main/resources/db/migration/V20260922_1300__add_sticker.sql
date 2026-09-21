-- AI 스티커. 낙서 한 장 → 워커(GPU)가 만든 스티커 한 장.
--
-- 작업 하나 = sticker_jobs 한 행이다. 멱등키·오늘 몫·워커 배정·재시도가 전부 이 표에 있고
-- 큐 미들웨어를 따로 두지 않는다. 워커는 GET /api/internal/ai-jobs/next 로 직접 집어간다.
--
-- 🔴 시각 컬럼만 TIMESTAMPTZ 다 (다른 표는 timestamp). DB 컨테이너는 UTC 이고 앱 컨테이너는
--    TZ=Asia/Seoul 이라, 일일 상한을 "KST 오늘" 로 세는 이 표에서는 벽시계 시각을 저장하면
--    매일 09시 이전 요청이 어제 몫으로 세어진다. 시점(instant)을 저장해 그 모호함을 없앤다.
--    경계 계산은 자바가 한다 (StickerService 의 KST 상수 참고).

CREATE TABLE sticker_jobs
(
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL,
    -- PENDING | RUNNING | DONE | FAILED
    status          VARCHAR(10) NOT NULL,
    idempotency_key VARCHAR(64) NOT NULL,
    -- 낙서 원본 (MinIO). 신고가 들어왔을 때 무엇으로 만들었는지 확인할 근거다
    sketch_key      TEXT        NOT NULL,
    -- 사용자가 적은 주제. 비어 있으면 워커의 캡셔너가 낙서를 읽어 채운다
    subject         VARCHAR(20),
    -- 같은 낙서로 다른 결과를 내는 값. 🔴 NULL 로 두면 워커가 자기 기본값을 써서
    -- "다시 만들기" 가 같은 그림을 준다. 서버가 반드시 채운다
    seed            INTEGER,
    -- 아직 아무도 쓰지 않는다. 나중에 넣으면 기존 전 건을 사람이 판단해야 해서 지금 파 둔다
    model_name      TEXT,
    model_version   TEXT,
    -- 워커가 complete 에 실어 보내는 meta ({seed, verdict, secs})
    params_json     JSONB,
    fail_reason     VARCHAR(40),
    worker_id       TEXT,
    retry_count     SMALLINT    NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,

    CONSTRAINT fk_sticker_jobs_user FOREIGN KEY (user_id) REFERENCES users (id),
    -- 같은 키로 두 번 오면 새로 만들지 않고 그때 준 작업을 돌려준다
    CONSTRAINT uq_sticker_jobs_idempotency UNIQUE (user_id, idempotency_key)
);

-- 워커 claim(status='PENDING' ORDER BY created_at)과 스위퍼가 같이 쓴다
CREATE INDEX idx_sticker_jobs_status_created ON sticker_jobs (status, created_at);
-- 오늘 몫 계산
CREATE INDEX idx_sticker_jobs_user_created ON sticker_jobs (user_id, created_at);

CREATE TABLE stickers
(
    id         BIGSERIAL PRIMARY KEY,
    job_id     BIGINT      NOT NULL,
    user_id    BIGINT      NOT NULL,
    -- 결과 PNG (MinIO). 소프트 삭제해도 오브젝트는 남긴다
    image_key  TEXT        NOT NULL,
    -- 아직 쓰지 않는다. 공개 스티커가 생기면 이 칸이 정한다
    visibility VARCHAR(10) NOT NULL DEFAULT 'PRIVATE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT fk_stickers_job  FOREIGN KEY (job_id) REFERENCES sticker_jobs (id),
    CONSTRAINT fk_stickers_user FOREIGN KEY (user_id) REFERENCES users (id),
    -- 🔴 최후의 방어선. 어떤 경로로든 한 작업에 두 스티커가 생기면 여기서 막힌다
    CONSTRAINT uq_stickers_job  UNIQUE (job_id)
);

-- 내 스티커 목록. 지운 것은 빼고 최신순
CREATE INDEX idx_stickers_user_created ON stickers (user_id, created_at DESC)
    WHERE deleted_at IS NULL;
