/**
 * 임베딩 후처리와 얼굴 정렬 — 순수 계산만. (React·DOM 모름)
 *
 * 🔴 임베딩은 민감정보입니다. 이 파일 어디에서도 값을 로그로 찍지 않습니다.
 *    디버깅이 필요하면 **차원 수와 노름**까지만 찍으세요.
 */

/**
 * L2 정규화. 코사인 유사도로 대조하려면 양쪽 다 단위 벡터여야 합니다.
 * 정규화를 안 하면 조명·거리에 따라 벡터 길이가 변해 임계값이 흔들립니다.
 */
export function l2Normalize(vector: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i]! * vector[i]!;

  const norm = Math.sqrt(sum);
  // 전부 0 인 벡터(모델이 이상한 걸 뱉은 경우)를 0 으로 나누지 않습니다.
  if (norm < 1e-8) return vector;

  const out = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i += 1) out[i] = vector[i]! / norm;
  return out;
}

/**
 * 정렬 기준점 (112×112).
 *
 * OpenCV `FaceRecognizerSF::alignCrop` 안의 `dst_points` 와 **같은 값**입니다
 * (modules/objdetect/src/face_recognize.cpp). SFace 는 이 위치로 워핑된 얼굴로
 * 학습됐으므로 **한 자리라도 바꾸면 유사도가 무너집니다.**
 *
 * 순서는 YuNet 랜드마크 순서와 인덱스로 1:1 대응합니다.
 * YuNet 의 첫 점은 "사람의 오른눈" = **이미지에서는 왼쪽**이고,
 * 여기 첫 점도 x=38.3(이미지 왼쪽)이라 그대로 맞습니다. 다시 정렬하지 마세요.
 */
export const SFACE_TEMPLATE: readonly (readonly [number, number])[] = [
  [38.2946, 51.6963], // 이미지 왼쪽 눈 (사람의 오른눈)
  [73.5318, 51.5014], // 이미지 오른쪽 눈
  [56.0252, 71.7366], // 코
  [41.5493, 92.3655], // 이미지 왼쪽 입꼬리
  [70.7299, 92.2041], // 이미지 오른쪽 입꼬리
];

/** canvas `setTransform(a, b, c, d, e, f)` 에 그대로 넣는 순서 */
export interface SimilarityTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * 두 점 집합을 맞추는 **닮음 변환**(회전 + 균일 확대 + 이동)을 구합니다.
 *
 * 어파인(6자유도) 대신 닮음(4자유도)을 쓰는 이유: 어파인은 얼굴을 늘려서
 * 랜드마크를 억지로 맞춥니다. 그러면 사람마다 다른 비율이 지워져
 * 오히려 임베딩이 뭉개집니다.
 *
 * 닫힌 해라 SVD 가 필요 없습니다 (2D Procrustes with scale).
 */
export function solveSimilarity(
  from: readonly (readonly [number, number])[],
  to: readonly (readonly [number, number])[],
): SimilarityTransform {
  const n = Math.min(from.length, to.length);

  let fx = 0;
  let fy = 0;
  let tx = 0;
  let ty = 0;
  for (let i = 0; i < n; i += 1) {
    fx += from[i]![0];
    fy += from[i]![1];
    tx += to[i]![0];
    ty += to[i]![1];
  }
  fx /= n;
  fy /= n;
  tx /= n;
  ty /= n;

  let sxx = 0; // Σ(x·u + y·v)
  let sxy = 0; // Σ(x·v − y·u)
  let norm = 0; // Σ(x² + y²)
  for (let i = 0; i < n; i += 1) {
    const x = from[i]![0] - fx;
    const y = from[i]![1] - fy;
    const u = to[i]![0] - tx;
    const v = to[i]![1] - ty;
    sxx += x * u + y * v;
    sxy += x * v - y * u;
    norm += x * x + y * y;
  }

  // 다섯 점이 한 점에 뭉쳐 있으면(검출 실패) 항등 변환으로 둡니다.
  if (norm < 1e-8) return { a: 1, b: 0, c: 0, d: 1, e: tx - fx, f: ty - fy };

  const cos = sxx / norm;
  const sin = sxy / norm;

  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: tx - (cos * fx - sin * fy),
    f: ty - (sin * fx + cos * fy),
  };
}

/**
 * 코사인 유사도. 두 임베딩이 같은 사람인지 보는 값입니다.
 *
 * 양쪽이 L2 정규화돼 있으면 내적과 같지만, 정규화를 안 한 벡터가 들어와도
 * 맞게 나오도록 노름으로 나눕니다 (OpenCV 의 FaceRecognizerSF::match 와 같은 식).
 *
 * ── 임계값 ────────────────────────────────────────────────
 * SFace 의 공식 권장값은 **0.363** 입니다 (OpenCV Zoo `demo.py` 의
 * `cosine_similarity_threshold`). 이보다 높으면 같은 사람으로 봅니다.
 * ArcFace 계열 감각으로 0.6~0.7 을 기대하면 같은 사람을 자꾸 거절하게 됩니다.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < n; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }

  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom < 1e-8 ? 0 : dot / denom;
}

/** SFace 공식 권장 임계값 (OpenCV Zoo). 이 값 이상이면 같은 사람. */
export const SFACE_COSINE_THRESHOLD = 0.363;

/**
 * 라플라시안 분산 — 흔들림(블러) 정도.
 * 값이 클수록 또렷합니다. 절대값은 해상도·조명에 따라 달라지므로
 * **같은 크기(112×112)의 정렬된 얼굴**에서만 비교하세요.
 */
export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const value =
        4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - width]! - gray[i + width]!;
      sum += value;
      sumSq += value * value;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}
