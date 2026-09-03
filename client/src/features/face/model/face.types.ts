/**
 * 얼굴 등록 도메인 타입.
 *
 * 🔴 이 파일에 **이미지를 담는 타입은 없습니다.** (CLAUDE.md 7장)
 *    Blob·File·dataURL 을 서버로 보내는 타입을 여기 추가하지 마세요.
 */

/**
 * 서버로 나가는 것 — **이게 전부입니다.**
 * 얼굴 사진은 기기 밖으로 나가지 않고, 브라우저에서 뽑은 특징값만 전달됩니다.
 */
export interface FaceEnrollRequest {
  /** L2 정규화된 임베딩. 차원은 모델이 정합니다 (SFace = 128) */
  embedding: number[];
  /** 어떤 모델로 뽑았는지. 게이트 대조 때 같은 모델이어야 합니다. */
  modelVersion: string;
}

/** 품질 게이트에서 걸린 이유 */
export type FaceQualityCode =
  | 'NO_FACE'
  | 'MANY_FACES'
  | 'TOO_SMALL'
  | 'OFF_CENTER'
  | 'NOT_FRONTAL'
  | 'BLURRY'
  | 'TOO_DARK';

export interface FaceQualityIssue {
  code: FaceQualityCode;
  /** 사용자에게 그대로 보여줄 한국어 안내 */
  message: string;
}

/**
 * 검출된 얼굴 하나.
 * 좌표는 **0~1 정규화**입니다 — 화면 크기가 바뀌어도 오버레이가 그대로 맞습니다.
 */
export interface DetectedFace {
  box: { x: number; y: number; width: number; height: number };
  /** 5점: 왼눈 · 오른눈 · 코 · 왼입꼬리 · 오른입꼬리 */
  landmarks: readonly (readonly [number, number])[];
  score: number;
}

/** 가이드 루프가 매 틱 화면에 돌려주는 것 */
export interface FaceFrameResult {
  faces: DetectedFace[];
  /** 지금 캡처해도 되는지 — 아니면 이유 */
  issue: FaceQualityIssue | null;
}
