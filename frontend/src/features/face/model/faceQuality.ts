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

export interface FrameMetrics {
  /** 정렬된 얼굴 크롭의 라플라시안 분산. 가이드 단계에서는 undefined */
  sharpness?: number;
  /** 정렬된 얼굴 크롭의 평균 밝기(0~255). 가이드 단계에서는 undefined */
  brightness?: number;
}

function issue(code: FaceQualityIssue['code'], message: string): FaceQualityIssue {
  return { code, message };
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
  if (faces.length === 0) {
    return issue('NO_FACE', '얼굴이 보이지 않아요. 화면 안에 얼굴을 맞춰주세요.');
  }
  if (faces.length > 1) {
    return issue('MANY_FACES', '얼굴이 여러 개 보여요. 혼자 있는 곳에서 찍어주세요.');
  }

  const face = faces[0]!;
  const { box, landmarks } = face;

  if (box.width < MIN_FACE_RATIO) {
    return issue('TOO_SMALL', '얼굴이 너무 작아요. 조금 더 가까이 와주세요.');
  }

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  if (Math.abs(cx - 0.5) > MAX_CENTER_OFFSET || Math.abs(cy - 0.5) > MAX_CENTER_OFFSET) {
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
