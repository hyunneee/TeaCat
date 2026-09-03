-- ================================
-- 얼굴 임베딩을 실제 사용 모델(SFace)에 맞춘다
-- ================================
--
-- V1 은 ArcFace 를 가정해 vector(512) 로 잡았지만, 클라이언트가 쓰는
-- face_recognition_sface_2021dec 는 128 차원(fc1 [1,128])을 뱉는다.
-- 차원이 다르면 게이트에서 대조 자체가 불가능하다.
--
-- 차원이 바뀌면 기존 임베딩은 의미가 없어 재등록해야 하므로 함께 비운다.
-- (아직 실사용 데이터가 없는 개발 단계라 가능한 조치다)

UPDATE users
SET face_id = NULL;

DELETE
FROM faces;

ALTER TABLE faces
    ALTER COLUMN embedding TYPE vector(128);

-- 어떤 모델로 뽑은 값인지. 모델을 바꾸면 예전 임베딩과 대조할 수 없으므로 함께 저장한다
ALTER TABLE faces
    ADD COLUMN model_version varchar(50) NOT NULL;
