import { http } from '@/shared/api';
import type { FaceEnrollRequest, FaceStatus } from '../model/face.types';

/**
 * 얼굴 등록 API.
 *
 * 🔴 **이미지를 보내는 함수는 여기 없습니다.** (CLAUDE.md 7장)
 *    `FormData`·`Blob`·base64 를 다루는 코드를 이 파일에 추가하면 규칙 위반입니다.
 *    서버가 이미지를 원한다고 해도 먼저 이 규칙을 들고 이야기하세요.
 *
 * TODO(backend): 백엔드 연동 지점.
 *   - 경로 `POST /face/enroll` (baseURL `/api` 가 붙어 `POST /api/face/enroll`)
 *   - 임베딩 차원·모델 버전 표기 규칙을 서버와 맞춰야 합니다 (CLAUDE.md 8장)
 *   - 지금은 src/mocks/handlers/face.ts 가 응답합니다.
 */
export const faceApi = {
  enroll: (body: FaceEnrollRequest) => http.post<FaceStatus>('/face/enroll', body),

  /** 등록 해제 — 되돌릴 수 없는 동작입니다 (확인 모달 필수) */
  remove: () => http.delete<FaceStatus>('/face/enroll'),
};
