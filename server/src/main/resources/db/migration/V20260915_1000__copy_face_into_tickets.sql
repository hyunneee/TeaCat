-- ================================
-- 티켓이 얼굴을 **가리키지 말고 들고 있게** 한다
-- ================================
-- 얼굴을 지우려 하면 이렇게 막혔다:
--   update or delete on table "faces" violates foreign key constraint
--   "fk_tickets_face" on table "tickets"
--
-- tickets.face_id 가 faces 의 **그 행을 가리키고** 있어서다. 예매를 한 번이라도 한
-- 회원은 얼굴 삭제도, 탈퇴도(withdraw 가 내부에서 얼굴을 지운다) 할 수 없었다.
--
-- 원래 의도는 "예매 당시의 얼굴을 티켓에 남긴다" 였다. 그러면 포인터가 아니라
-- **복사본**이어야 한다 — 그래야 원본을 지워도 티켓이 아무 영향을 받지 않는다.
--
-- 🔴 기존 데이터는 하나도 잃지 않는다. tickets.face_id 는 NOT NULL + FK 라
--    **모든 티켓이 실재하는 faces 행을 가리키는 것이 제약으로 보장**된다(고아 행이
--    있을 수 없다). 아래 UPDATE 가 전 행을 채우고, 혹시라도 빈 칸이 남으면
--    SET NOT NULL 에서 마이그레이션이 **실패**한다 — 조용히 넘어가지 않는다.

ALTER TABLE tickets ADD COLUMN face_embedding vector(128);
ALTER TABLE tickets ADD COLUMN face_model_version varchar(50);

-- 지금 가리키고 있는 얼굴을 그대로 복사해 온다
UPDATE tickets t
SET face_embedding     = f.embedding,
    face_model_version = f.model_version
FROM faces f
WHERE f.id = t.face_id;

-- 빈 칸이 하나라도 있으면 여기서 멈춘다 (위 주석의 안전장치)
ALTER TABLE tickets ALTER COLUMN face_embedding SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN face_model_version SET NOT NULL;

-- 복사가 끝났으므로 원본을 붙잡고 있을 이유가 없다.
-- 🔴 이 두 줄이 실제로 얼굴 삭제·탈퇴를 풀어 준다.
--    face_id 를 남겨두면(제약만 떼도) 아무도 안 읽는 죽은 숫자가 되므로 함께 지운다 —
--    티켓이 쓰는 값은 이제 위의 face_embedding 이다.
ALTER TABLE tickets DROP CONSTRAINT fk_tickets_face;
ALTER TABLE tickets DROP COLUMN face_id;
