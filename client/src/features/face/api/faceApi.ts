import { http } from '@/shared/api';
import type { FaceEnrollRequest } from '../model/face.types';

/**
 * 얼굴 등록 API.
 *
 * 🔴 **이미지를 보내는 함수는 여기 없습니다.** (CLAUDE.md 7장)
 *    `FormData`·`Blob`·base64 를 다루는 코드를 이 파일에 추가하면 규칙 위반입니다.
 *    서버가 이미지를 원한다고 해도 먼저 이 규칙을 들고 이야기하세요.
 *
 * 서버는 임베딩과 모델 버전만 받아 저장하고, 성공 여부만 돌려줍니다.
 * 등록 여부(`faceRegistered`)의 원본은 `GET /users/me` 하나뿐입니다.
 */
export const faceApi = {
  enroll: (body: FaceEnrollRequest) => http.post<void>('/users/me/face', body),

  /** 등록 해제 — 되돌릴 수 없는 동작입니다 (확인 모달 필수) */
  remove: () => http.delete<void>('/users/me/face'),
};
