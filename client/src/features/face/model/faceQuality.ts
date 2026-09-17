import type { DetectedFace, FaceQualityIssue } from './face.types';

/**
 * 캡처 품질 게이트 — **순수 함수**입니다.
 *
 * 등록 시점에 대충 찍힌 얼굴을 받아두면 게이트에서 본인이 못 들어갑니다.
 * 그래서 "안 되면 왜 안 되는지"를 화면에 계속 띄워두고, 통과했을 때만 찍게 합니다.
 *
 * 판정 순서가 곧 안내 순서입니다. 한 번에 하나씩만 말해 주세요 —
 * "얼굴이 작고 기울었고 어둡습니다" 같은 안내는 아무것도 고치게 만들지 못합니다.
 */

/** 프레임 짧은 변 대비 얼굴 폭이 이 비율보다 작으면 너무 멉니다 */
const MIN_FACE_RATIO = 0.32;
/** 프레임 중앙에서 이만큼(정규화 거리) 넘게 벗어나면 가운데로 안내 */
const MAX_CENTER_OFFSET = 0.14;
/**
 * 정면 판정.
 * 코가 두 눈 사이 어디쯤 있는지로 좌우 회전(yaw)을 봅니다.
 * 0.5 가 정중앙이고, 이보다 치우치면 고개가 돌아간 것입니다.
 */
const MAX_YAW_SKEW = 0.18;
/** 두 눈을 잇는 선의 기울기(라디안). 약 12도 */
const MAX_ROLL_RAD = 0.21;
/** 정렬된 얼굴의 라플라시안 분산이 이보다 낮으면 흐릿합니다 */
const MIN_SHARPNESS = 55;
/** 평균 밝기(0~255) */
const MIN_BRIGHTNESS = 45;
/**
 * 뒤에 선 사람을 "헷갈리는 상대" 로 볼 크기 비율.
 *
 * 카메라 앞에 선 사람이 뒤에 선 사람보다 크게 잡힙니다. 이 비율보다 작으면
 * 명백히 배경이라 무시하고, 이만큼 크면서 **가운데에도 있으면** 누구를 찍는지
 * 정할 수 없다고 봅니다.
 */
const AMBIGUOUS_SIZE_RATIO = 0.8;

export interface FrameMetrics {
  /** 정렬된 얼굴 크롭의 라플라시안 분산. 가이드 단계에서는 undefined */
  sharpness?: number;
  /** 정렬된 얼굴 크롭의 평균 밝기(0~255). 가이드 단계에서는 undefined */
  brightness?: number;
}

function issue(code: FaceQualityIssue['code'], message: string): FaceQualityIssue {
  return { code, message };
}

function centerOf(box: DetectedFace['box']): [number, number] {
  return [box.x + box.width / 2, box.y + box.height / 2];
}

function isCentered(box: DetectedFace['box']): boolean {
  const [cx, cy] = centerOf(box);
  return Math.abs(cx - 0.5) <= MAX_CENTER_OFFSET && Math.abs(cy - 0.5) <= MAX_CENTER_OFFSET;
}

/**
 * 찍을 얼굴 하나를 고릅니다 — <b>가장 크게 잡힌 얼굴</b>.
 *
 * <p>🔴 <b>예전에는 얼굴이 둘 이상이면 그냥 거절했습니다.</b> 그건 조용한 방에서 혼자
 * 등록할 때만 성립하는 규칙이라, <b>현장 검표에서는 아예 동작하지 않습니다</b> — 공연장
 * 입구에는 언제나 뒤에 줄이 서 있습니다.
 *
 * <p>가장 큰 얼굴이 카메라에 가장 가까운 사람이고, 그게 가이드 원 안에 선 사람입니다.
 * 뒤에 선 사람은 더 작게 잡히므로 자연히 밀려납니다. 원의 픽셀 좌표로 판정하지 않는
 * 이유는, 미리보기가 {@code object-cover} 로 잘려 있어 <b>화면의 원과 검출 좌표계가
 * 일치하지 않기</b> 때문입니다. 크기는 그 어긋남과 무관합니다.
 *
 * <p>🔴 <b>워커의 선택과 같아야 합니다.</b> {@code face.worker.ts} 도 임베딩할 얼굴을
 * 같은 규칙(가장 큰 것)으로 고릅니다. 둘이 갈라지면 <b>화면은 A 를 통과시켰는데 임베딩은
 * B 에서 뽑히는</b> 일이 생깁니다 — 남의 얼굴로 등록되고, 아무도 눈치채지 못합니다.
 */
export function selectPrimaryFace(faces: readonly DetectedFace[]): DetectedFace | null {
  let primary: DetectedFace | null = null;

  for (const face of faces) {
    if (!primary || face.box.width > primary.box.width) primary = face;
  }

  return primary;
}

/**
 * 얼굴이 지금 어떤 자세인가 — 숫자 셋.
 *
 * <p><b>자세를 보는 모델을 따로 붙이지 않습니다.</b> YuNet 이 주는 5점 랜드마크로 충분합니다.
 * 전용 머리자세 모델(6DRepNet 류)을 얹으면 런타임 규칙(client/CLAUDE.md 7장)에 걸리고,
 * 무엇보다 <b>품질 게이트가 정면만 통과시키므로 잴 수 있는 각도 범위가 애초에 좁습니다.</b>
 *
 * <p>🔴 <b>좌우 방향을 쓰지 마세요.</b> 미리보기는 거울처럼 뒤집혀 있어서
 * ({@code CameraStage} 의 {@code scale-x-[-1]}) "사용자가 보는 왼쪽" 과
 * "검출 좌표의 왼쪽" 이 반대입니다. 방향을 안내에 쓰면 반대로 말하게 됩니다 —
 * {@link FacePose#yaw} 는 <b>치우친 정도</b>로만 쓰고 부호는 "아까와 반대쪽인가" 를
 * 볼 때만 쓰세요.
 *
 * @returns 랜드마크가 모자라면 null
 */
export function readPose(face: DetectedFace): FacePose | null {
  const [leftEye, rightEye, nose] = face.landmarks as readonly (readonly [number, number])[];
  if (!leftEye || !rightEye || !nose) return null;

  const eyeSpan = rightEye[0] - leftEye[0];
  if (Math.abs(eyeSpan) < 1e-6) return null;

  return {
    size: face.box.width,
    yaw: (nose[0] - leftEye[0]) / eyeSpan,
    roll: Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]),
  };
}

export interface FacePose {
  /** 얼굴 폭 (0~1). 클수록 카메라에 가깝습니다 */
  size: number;
  /** 코가 두 눈 사이 어디인가. **0.5 가 정중앙** */
  yaw: number;
  /** 두 눈을 잇는 선의 기울기 (라디안) */
  roll: number;
}

/**
 * 지금 프레임으로 등록해도 되는가.
 * @param faces 정규화 좌표(0~1)로 검출된 얼굴들
 * @returns 통과면 null, 아니면 사용자에게 보여줄 이유 하나
 */
export function checkFaceQuality(
  faces: readonly DetectedFace[],
  metrics: FrameMetrics = {},
): FaceQualityIssue | null {
  const face = selectPrimaryFace(faces);

  if (!face) {
    return issue('NO_FACE', '얼굴이 보이지 않아요. 화면 안에 얼굴을 맞춰주세요.');
  }

  const { box, landmarks } = face;

  /* 배경에 있는 사람은 더 작게 잡히므로 무시합니다. 다만 비슷한 크기의 얼굴이
     **함께 가운데에** 있으면 누구를 찍는 건지 정할 수 없습니다 — 두 사람이 나란히
     선 경우입니다. 그때만 막습니다. */
  const contender = faces.find(
    (other) =>
      other !== face &&
      other.box.width >= box.width * AMBIGUOUS_SIZE_RATIO &&
      isCentered(other.box),
  );
  if (contender) {
    return issue('MANY_FACES', '두 사람이 함께 보여요. 한 사람만 화면 가운데에 서 주세요.');
  }

  if (box.width < MIN_FACE_RATIO) {
    return issue('TOO_SMALL', '얼굴이 너무 작아요. 조금 더 가까이 와주세요.');
  }

  if (!isCentered(box)) {
    return issue('OFF_CENTER', '얼굴을 가운데로 맞춰주세요.');
  }

  // 랜드마크가 없는 검출기를 붙였다면 각도 판정은 건너뜁니다.
  if (landmarks.length >= 3) {
    const [leftEye, rightEye, nose] = landmarks as readonly (readonly [number, number])[];

    if (leftEye && rightEye && nose) {
      const eyeSpan = rightEye[0] - leftEye[0];
      if (Math.abs(eyeSpan) > 1e-6) {
        // 코가 두 눈 사이 어디에 있나 (0=왼눈, 1=오른눈)
        const noseRatio = (nose[0] - leftEye[0]) / eyeSpan;
        if (Math.abs(noseRatio - 0.5) > MAX_YAW_SKEW) {
          return issue('NOT_FRONTAL', '정면을 바라봐 주세요.');
        }
      }

      const roll = Math.atan2(rightEye[1] - leftEye[1], rightEye[0] - leftEye[0]);
      if (Math.abs(roll) > MAX_ROLL_RAD) {
        return issue('NOT_FRONTAL', '고개를 세워 정면을 바라봐 주세요.');
      }
    }
  }

  /* 아래 둘은 얼굴을 잘라내 봐야 알 수 있어서 **캡처 시점에만** 검사합니다.
     가이드 루프에서 매 프레임 계산하면 5fps 를 못 지킵니다. */
  if (metrics.brightness !== undefined && metrics.brightness < MIN_BRIGHTNESS) {
    return issue('TOO_DARK', '조금 더 밝은 곳에서 찍어주세요.');
  }
  if (metrics.sharpness !== undefined && metrics.sharpness < MIN_SHARPNESS) {
    return issue('BLURRY', '흔들렸어요. 잠깐 멈춘 채로 다시 찍어주세요.');
  }

  return null;
}

/** 가이드 문구 — 아직 아무것도 검출되기 전 */
export const FACE_GUIDE_IDLE = '화면 안의 원에 얼굴을 맞춰주세요.';
export const FACE_GUIDE_READY = '좋아요. 이대로 촬영해 주세요.';
