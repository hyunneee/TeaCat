-- ================================
-- 얼굴이 없는 기존 회원에게 기본 얼굴을 채워 넣는다
-- ================================
--
-- 이제 가입 시점에 얼굴 자리를 채운다(AuthService.signup / OauthService.completeSignup).
-- 그 전에 가입한 회원은 비어 있어서 예매 가드(RequireFace)에 계속 막힌다.
--
-- 🔴 사람 얼굴에서 뽑은 값이 아니다. 모든 성분이 같은 단위 벡터이고,
--    model_version 이 실제 모델('face_recognition_sface_2021dec…')과 다르다.
--    그래서 본인 확인은 대조를 시도하지 않고 FACE_MODEL_MISMATCH 로 거절한다 —
--    잘못 통과시키는 일이 없다. (Face.DEFAULT_MODEL_VERSION 주석 참고)
--
-- 1/sqrt(128) = 0.08838834764831845

WITH inserted AS (
    INSERT INTO faces (embedding, model_version)
        SELECT
            array_fill(0.08838834764831845::real, ARRAY [128])::vector(128),
            'bootstrap-default'
        FROM users u
        WHERE u.face_id IS NULL
          AND u.deleted_at IS NULL
        RETURNING id
)
-- INSERT 순서와 UPDATE 대상 순서를 맞추기 위해 번호를 매겨 짝짓는다
   , numbered_faces AS (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM inserted)
   , numbered_users AS (SELECT id, row_number() OVER (ORDER BY id) AS rn
                        FROM users
                        WHERE face_id IS NULL
                          AND deleted_at IS NULL)
UPDATE users u
SET face_id = f.id
FROM numbered_users nu
         JOIN numbered_faces f ON f.rn = nu.rn
WHERE u.id = nu.id;
