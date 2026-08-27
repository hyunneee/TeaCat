import { http } from '@/shared/api';
import type { FaceStatus } from '../model/face.types';

export const faceApi = {
  /**
   * 얼굴 이미지 등록.
   * 실제 서버는 이미지에서 임베딩을 추출해 저장합니다.
   * (사용할 인식 라이브러리와 전송 포맷은 아직 미정 — CLAUDE.md 8장)
   */
  register: (image: Blob) => {
    const form = new FormData();
    form.append('image', image, 'face.jpg');
    return http.post<FaceStatus>('/users/me/face', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  remove: () => http.delete<FaceStatus>('/users/me/face'),
};
