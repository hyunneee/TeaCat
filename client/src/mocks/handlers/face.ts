import { mock, mockError } from '../router';
import { requireUser } from './auth';

/**
 * 얼굴 등록 — **임베딩만** 받습니다.
 *
 * 🔴 이미지를 받는 핸들러를 여기 추가하지 마세요. 실서버도 같습니다. (CLAUDE.md 7장)
 *    목업이 이미지를 받아주면 프론트에 이미지를 보내는 코드가 생기고, 그대로 배포됩니다.
 *
 * 실서버가 해야 할 일(참고):
 *   - 임베딩 차원·modelVersion 검증
 *   - 이미 등록된 사용자면 교체할지 거절할지 정책 결정
 *   - 다른 사람 임베딩과의 중복 등록(한 얼굴로 여러 계정) 검사 ← 암표 방지의 핵심
 */

/** SFace 가 뽑는 차원(실측 fc1 [1,128]). 다르면 게이트에서 대조가 안 됩니다. */
const EMBEDDING_DIM = 128;

mock('POST', '/face/enroll', (ctx) => {
  const user = requireUser(ctx.headers);
  const { embedding, modelVersion } = (ctx.body ?? {}) as {
    embedding?: unknown;
    modelVersion?: unknown;
  };

  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
    throw mockError(
      400,
      'FACE_EMBEDDING_INVALID',
      `임베딩은 ${EMBEDDING_DIM}차원이어야 합니다.`,
    );
  }
  if (typeof modelVersion !== 'string' || modelVersion.length === 0) {
    throw mockError(400, 'FACE_MODEL_VERSION_REQUIRED', '모델 버전이 필요합니다.');
  }

  /* 목업은 값을 저장하지 않습니다 — 등록됐다는 사실만 기억합니다.
     (임베딩은 민감정보라 개발용 저장소에도 굳이 남기지 않습니다) */
  user.faceRegistered = true;
  return { faceRegistered: true };
});

mock('DELETE', '/face/enroll', (ctx) => {
  const user = requireUser(ctx.headers);
  user.faceRegistered = false;
  return { faceRegistered: false };
});
