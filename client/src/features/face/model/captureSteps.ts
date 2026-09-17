import type { FacePose } from './faceQuality';

/**
 * 촬영 단계 하나 — 지시문과 <b>그 지시를 지켰는지 보는 검사</b>.
 *
 * <p>🔴 <b>지시만 하고 검증하지 않으면 소용이 없습니다.</b> 가만히 있어도 그대로 찍혀서
 * 거의 같은 프레임이 모이고, 그러면 평균을 내도 한 장으로 등록한 것과 다를 바가 없습니다.
 * 실측이라면 "같은 사람" 유사도가 0.99 로 떠서 실제로는 통과하지 못할 임계값도 통과해
 * 보입니다. 그래서 <b>조건을 맞출 때까지 셔터가 안 눌립니다.</b>
 *
 * <p>조건은 전부 <b>품질 게이트가 허용하는 범위 안</b>입니다 — "살짝" 이 붙은 이유입니다.
 * 운영에서는 {@code checkFaceQuality} 가 정면이 아닌 프레임을 아예 임베딩하지 않으므로,
 * 고개를 크게 돌려 찍은 얼굴은 애초에 등록되지 않습니다.
 *
 * <p>🔴 <b>좌우를 말하지 않습니다.</b> 미리보기가 거울이라 "왼쪽" 이 검출 좌표의 오른쪽입니다.
 * 방향을 안내하면 반대로 말하게 되므로 "옆으로" 로 두고 <b>치우친 정도</b>만 봅니다
 * ({@code readPose} 주석).
 */
export interface CaptureStep {
  prompt: string;
  /** 못 맞췄을 때 보여줄 한 줄. 없으면 검증 없는 단계 */
  hint?: string;
  /**
   * 지시를 지켰는가.
   *
   * @param pose  지금 프레임의 자세
   * @param taken 이번 세션에서 이미 찍은 자세들 (첫 장이 거리 비교의 기준선)
   */
  check?: (pose: FacePose, taken: readonly FacePose[]) => boolean;
}

/** 정면으로 볼 최대 치우침 — 기준선을 잡는 첫 장에만 쓴다 */
const FRONTAL_YAW = 0.05;
const FRONTAL_ROLL = 0.07;
/** "살짝 돌림/기울임" 으로 인정할 최소 변화 */
const TURNED_YAW = 0.08;
const TILTED_ROLL = 0.09;

const FRONTAL: CaptureStep = {
  prompt: '정면을 보세요',
  hint: '코가 두 눈 가운데 오도록 똑바로',
  // 🔴 첫 장이 이번 세션의 기준선이 된다. 아래 거리 비교가 여기에 달려 있다
  check: (p) => Math.abs(p.yaw - 0.5) < FRONTAL_YAW && Math.abs(p.roll) < FRONTAL_ROLL,
};

const CLOSER: CaptureStep = {
  prompt: '조금 가까이 오세요',
  hint: '처음보다 눈에 띄게 가까이',
  check: (p, taken) => !taken[0] || p.size >= taken[0].size * 1.12,
};

const FARTHER: CaptureStep = {
  prompt: '조금 멀어지세요',
  hint: '처음보다 눈에 띄게 멀리',
  check: (p, taken) => !taken[0] || p.size <= taken[0].size * 0.9,
};

const TURNED: CaptureStep = {
  prompt: '고개를 살짝 옆으로 돌려요',
  hint: '아주 조금만 — 정면을 벗어나면 인식이 안 됩니다',
  check: (p) => Math.abs(p.yaw - 0.5) >= TURNED_YAW,
};

const TURNED_BACK: CaptureStep = {
  prompt: '반대쪽으로 살짝 돌려요',
  hint: '아까와 반대 방향으로',
  check: (p, taken) => {
    if (Math.abs(p.yaw - 0.5) < TURNED_YAW) return false;

    /* 🔴 인덱스로 찾지 않습니다. 단계 목록이 화면마다 달라서(등록 5장 · 실측 7장)
       "네 번째 장" 같은 가정은 한쪽을 고치는 순간 조용히 어긋납니다.
       **직전에 돌렸던 자세**를 되짚어 부호를 비교합니다. */
    const previous = [...taken].reverse().find((t) => Math.abs(t.yaw - 0.5) >= TURNED_YAW);
    return !previous || Math.sign(p.yaw - 0.5) !== Math.sign(previous.yaw - 0.5);
  },
};

const TILTED: CaptureStep = {
  prompt: '고개를 살짝 기울여요',
  hint: '갸웃하듯 아주 조금만',
  check: (p) => Math.abs(p.roll) >= TILTED_ROLL,
};

/* 표정은 랜드마크로 잴 수 없어 검증하지 않습니다. 그래도 현장에서 실제로 일어나는
   변화라(웃는 사람·무표정인 사람) 표본에 섞어 둡니다.

   🔴 **안경을 벗으라는 단계는 두지 않습니다.** 잴 수도 없거니와, 등록할 때 안경을 쓴
      사람은 입장할 때도 대개 쓰고 옵니다. 안경 유무는 **서로 다른 갈래**라 평균에 섞으면
      양쪽 다 어중간해집니다 (`centroidOf` 주석). 쓴 사람은 쓴 채로 찍습니다. */
const SMILE: CaptureStep = { prompt: '살짝 웃어 보세요' };

/**
 * 얼굴 등록 — 5장.
 *
 * <p>사용자가 앱에서 <b>한 번만</b> 하는 일이라 짧게 잡았습니다. 전부 검증되는 단계라
 * 다섯 장이 확실히 다른 조건에서 찍힙니다 — 그게 평균을 쓸모 있게 만듭니다.
 */
export const REGISTER_STEPS: readonly CaptureStep[] = [
  FRONTAL,
  CLOSER,
  FARTHER,
  TURNED,
  TURNED_BACK,
];

/** 임계값 실측 — 7장. 분포를 보려면 표본이 넓을수록 좋습니다 */
export const BENCH_STEPS: readonly CaptureStep[] = [
  FRONTAL,
  CLOSER,
  FARTHER,
  TURNED,
  TURNED_BACK,
  TILTED,
  SMILE,
];
