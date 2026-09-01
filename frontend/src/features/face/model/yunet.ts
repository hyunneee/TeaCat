import type { DetectedFace } from './face.types';

/**
 * YuNet 얼굴 검출기의 **출력 해석** — 이 파일 하나가 모델 규격에 묶여 있습니다.
 *
 * 검출기를 바꾸면 여기만 갈아끼우세요. 나머지 코드는 `DetectedFace` 만 압니다.
 *
 * ── 왜 YuNet 인가 ─────────────────────────────────────────
 * 랜드마크 5점을 주는 검출기 중 가장 작습니다(232KB).
 * SFace 는 **YuNet 의 5점으로 정렬한 얼굴**을 전제로 학습됐습니다.
 * 박스만 주는 더 작은 검출기로 바꾸면 정렬을 못 해 인식률이 무너집니다.
 *
 * ── 입력 (실측 규격 · scripts/inspect-face-models.mjs) ────
 *   input  [1, 3, 640, 640]  BGR, 0~255 (평균 차감·스케일 없음)
 *
 * 🔴 **shape 이 고정입니다.** OpenCV 의 YuNet 은 setInputSize 로 크기를 바꿀 수
 *    있지만, 이 ONNX 는 640 으로 고정 export 된 파일입니다. 다른 크기를 넣으면
 *    onnxruntime 이 거부합니다. 그래서 프레임을 640 정사각으로 **레터박스**해서 넣고,
 *    나온 좌표에서 여백을 되돌립니다.
 *
 * ── 출력 (stride 별 3세트 · 실측) ─────────────────────────
 *   cls_8  [1, 6400, 1]   cls_16  [1, 1600, 1]   cls_32  [1, 400, 1]
 *   obj_8  [1, 6400, 1]   obj_16  [1, 1600, 1]   obj_32  [1, 400, 1]
 *   bbox_8 [1, 6400, 4]   bbox_16 [1, 1600, 4]   bbox_32 [1, 400, 4]
 *   kps_8  [1, 6400,10]   kps_16  [1, 1600,10]   kps_32  [1, 400,10]
 *
 *   6400 = 80×80 (640/8) · 1600 = 40×40 (640/16) · 400 = 20×20 (640/32), 행 우선
 *   → 아래 격자 복원식(col = i % cols, row = i / cols)이 이 배치를 그대로 씁니다.
 */

export const DETECTOR_INPUT_SIZE = 640;
const STRIDES = [8, 16, 32] as const;
const SCORE_THRESHOLD = 0.6;
const NMS_IOU = 0.3;

/** 이 이름들이 없으면 다른 모델입니다 — 조용히 이상한 좌표를 내는 대신 터뜨립니다. */
export function detectorOutputNames(): string[] {
  return STRIDES.flatMap((s) => [`cls_${s}`, `obj_${s}`, `bbox_${s}`, `kps_${s}`]);
}

interface RawFace {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  kps: [number, number][];
}

type TensorLike = { data: Float32Array | Uint8Array | Int8Array | ArrayLike<number> };

function values(tensor: TensorLike | undefined): ArrayLike<number> {
  if (!tensor) throw new Error('[face] 검출기 출력이 비어 있습니다.');
  return tensor.data;
}

/**
 * 모델 출력 → 얼굴 목록.
 * 좌표는 **검출 입력(640×640) 기준 픽셀**입니다. 원본 프레임으로 되돌리는 건 호출부가 합니다.
 */
export function decodeYunet(outputs: Record<string, TensorLike>, inputSize: number): RawFace[] {
  const found: RawFace[] = [];

  for (const stride of STRIDES) {
    const cls = values(outputs[`cls_${stride}`]);
    const obj = values(outputs[`obj_${stride}`]);
    const bbox = values(outputs[`bbox_${stride}`]);
    const kps = values(outputs[`kps_${stride}`]);

    const cols = Math.floor(inputSize / stride);
    const rows = Math.floor(inputSize / stride);

    for (let index = 0; index < rows * cols; index += 1) {
      /* cls 와 obj 를 곱한 뒤 제곱근 — YuNet 이 학습된 방식입니다.
         둘 중 하나만 쓰면 배경에서 오검출이 크게 늘어납니다. */
      const raw = (cls[index] ?? 0) * (obj[index] ?? 0);
      const score = raw > 0 ? Math.sqrt(raw) : 0;
      if (score < SCORE_THRESHOLD) continue;

      const col = index % cols;
      const row = Math.floor(index / cols);
      const b = index * 4;

      const cx = (col + (bbox[b] ?? 0)) * stride;
      const cy = (row + (bbox[b + 1] ?? 0)) * stride;
      const w = Math.exp(bbox[b + 2] ?? 0) * stride;
      const h = Math.exp(bbox[b + 3] ?? 0) * stride;

      const k = index * 10;
      const points: [number, number][] = [];
      for (let p = 0; p < 5; p += 1) {
        points.push([
          (col + (kps[k + p * 2] ?? 0)) * stride,
          (row + (kps[k + p * 2 + 1] ?? 0)) * stride,
        ]);
      }

      found.push({ x: cx - w / 2, y: cy - h / 2, w, h, score, kps: points });
    }
  }

  return nms(found);
}

/** 같은 얼굴에 겹쳐 뜬 박스를 하나로 줄입니다 */
function nms(faces: RawFace[]): RawFace[] {
  const sorted = [...faces].sort((a, b) => b.score - a.score);
  const kept: RawFace[] = [];

  for (const face of sorted) {
    const overlaps = kept.some((other) => iou(face, other) > NMS_IOU);
    if (!overlaps) kept.push(face);
  }
  return kept;
}

function iou(a: RawFace, b: RawFace): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * 검출 좌표(640 기준)를 **원본 프레임의 0~1 정규화 좌표**로 옮깁니다.
 * 레터박스로 넣었으므로 여백(pad)을 빼고 스케일로 나눕니다.
 */
export function toNormalized(
  face: RawFace,
  fit: { scale: number; padX: number; padY: number; frameWidth: number; frameHeight: number },
): DetectedFace {
  const toFrame = (x: number, y: number): [number, number] => [
    (x - fit.padX) / fit.scale / fit.frameWidth,
    (y - fit.padY) / fit.scale / fit.frameHeight,
  ];

  const [x, y] = toFrame(face.x, face.y);
  const [x2, y2] = toFrame(face.x + face.w, face.y + face.h);

  return {
    box: { x, y, width: x2 - x, height: y2 - y },
    landmarks: face.kps.map(([kx, ky]) => toFrame(kx, ky)),
    score: face.score,
  };
}

/**
 * 검출 좌표를 **원본 프레임 픽셀**로. (정렬용 — 정규화하면 종횡비가 깨집니다)
 */
export function toFramePixels(
  face: RawFace,
  fit: { scale: number; padX: number; padY: number },
): [number, number][] {
  return face.kps.map(([kx, ky]) => [(kx - fit.padX) / fit.scale, (ky - fit.padY) / fit.scale]);
}

export type { RawFace };
