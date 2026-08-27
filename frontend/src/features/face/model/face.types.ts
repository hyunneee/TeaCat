export interface FaceStatus {
  faceRegistered: boolean;
}

/** 얼굴 등록 방법 — 촬영 또는 파일 업로드 */
export type FaceCaptureMode = 'CAMERA' | 'UPLOAD';
