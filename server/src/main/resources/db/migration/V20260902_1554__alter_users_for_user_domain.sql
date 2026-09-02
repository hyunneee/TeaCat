-- ================================
-- 회원 도메인 (FR-101 ~ FR-111) 반영
-- ================================

-- 닉네임: 기존 행이 있을 수 있으므로 NULL 허용으로 추가 후 채우고 NOT NULL 로 승격
ALTER TABLE users
    ADD COLUMN nickname varchar(50);

UPDATE users
SET nickname = '회원' || id
WHERE nickname IS NULL;

ALTER TABLE users
    ALTER COLUMN nickname SET NOT NULL;

-- 얼굴 등록은 가입과 분리된 별도 API(API-109) 이므로 가입 시점에는 얼굴이 없다
ALTER TABLE users
    ALTER COLUMN face_id DROP NOT NULL;

-- 생성/수정 시각, 탈퇴(소프트 삭제) 시각
ALTER TABLE users
    ADD COLUMN created_at timestamp NOT NULL DEFAULT now(),
    ADD COLUMN updated_at timestamp NOT NULL DEFAULT now(),
    ADD COLUMN deleted_at timestamp;

-- 이메일/닉네임 중복 방지.
-- 탈퇴한 회원(deleted_at IS NOT NULL)은 제외해서 같은 이메일로 재가입할 수 있게 한다
CREATE UNIQUE INDEX uq_users_email_active
    ON users (email)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_users_nickname_active
    ON users (nickname)
    WHERE deleted_at IS NULL;
