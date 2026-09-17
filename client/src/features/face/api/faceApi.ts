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

  /* 🔴 **대조하는 함수는 여기 없습니다.** 본인 확인은 공연장 게이트에서만 합니다 —
     `features/checkin` 의 `checkInApi.verify` 입니다. 예전에는 사용자가 자기 티켓에서
     눌러보는 검증용 화면이 있었는데, 확인만 하고 티켓 상태는 바꾸지 않아 할 일이
     없었습니다. 저장된 임베딩을 받아와 브라우저에서 비교하는 함수를 여기(또는 어디에도)
     만들지 마세요 — 생체 특징값이 기기로 나가고, 판정을 콘솔로 뒤집을 수 있게 됩니다.
     ⚠️ 서버의 `POST /users/me/face/verify` 는 아직 열려 있지만 앱에서 부르지 않습니다. */

  /** 등록 해제 — 되돌릴 수 없는 동작입니다 (확인 모달 필수) */
  remove: () => http.delete<void>('/users/me/face'),
};
