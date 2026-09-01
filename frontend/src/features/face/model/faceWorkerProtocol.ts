import type { DetectedFace } from './face.types';

/**
 * 메인 스레드 ↔ 얼굴 워커 사이의 메시지 규격.
 *
 * 🔴 워커 **밖으로 나가는 메시지에 이미지가 없습니다.** 얼굴 좌표와 임베딩뿐입니다.
 *    프레임(ImageBitmap)은 워커로 **들어가기만** 하고, 쓰고 나면 즉시 close() 합니다.
 */

export interface FaceWorkerInit {
  type: 'init';
  /** ORT 의 wasm 바이너리 주소 — 필요한 빌드 하나만 받습니다 */
  wasmUrl: string;
  detectorUrl: string;
  embedderUrl: string;
}

export interface FaceWorkerDetect {
  type: 'detect';
  id: number;
  /** transfer 로 넘깁니다 (복사 없음) */
  frame: ImageBitmap;
}

export interface FaceWorkerEmbed {
  type: 'embed';
  id: number;
  frame: ImageBitmap;
}

export type FaceWorkerRequest = FaceWorkerInit | FaceWorkerDetect | FaceWorkerEmbed;

export interface FaceWorkerReady {
  type: 'ready';
  /** 모델을 새로 받았는지, 캐시에서 꺼냈는지 — 용량 측정용 */
  cached: boolean;
  bytes: number;
}

export interface FaceWorkerDetected {
  type: 'detected';
  id: number;
  faces: DetectedFace[];
}

export interface FaceWorkerEmbedded {
  type: 'embedded';
  id: number;
  faces: DetectedFace[];
  /** L2 정규화된 임베딩. 품질 게이트를 통과했을 때만 채워집니다. */
  embedding: Float32Array | null;
  sharpness: number;
  brightness: number;
}

export interface FaceWorkerFailed {
  type: 'failed';
  /** init 실패면 id 가 없습니다 */
  id?: number;
  message: string;
}

export type FaceWorkerResponse =
  | FaceWorkerReady
  | FaceWorkerDetected
  | FaceWorkerEmbedded
  | FaceWorkerFailed;
