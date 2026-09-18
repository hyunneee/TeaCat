import type { FacePose } from './faceQuality';

/**
 * 촬영 단계 하나 — 지시문과 <b>그 지시를 지켰는지 보는 검사</b>.
 *
 * <p>🔴 <b>지시만 하고 검증하지 않으면 소용이 없습니다.</b> 가만히 있어도 그대로 찍혀서
 * 거의 같은 프레임이 네 장 모이고, 그러면 평균을 내도 한 장으로 등록한 것과 다를 바가
 * 없습니다. 그래서 <b>자세가 달라질 때까지 셔터가 안 눌립니다.</b>
 *
 * <p>🔴 <b>방향을 지정하지 않습니다.</b> 예전에는 "고개를 살짝 옆으로 돌려요" 처럼 시켰는데,
 * 품질 게이트는 같은 순간에 <b>정면을 요구합니다</b>({@code checkFaceQuality} 의
 * {@code MAX_YAW_SKEW}). 그래서 조금만 더 돌리면 "정면을 바라봐 주세요" 가 떠서
 * <b>화면이 서로 반대되는 말을 했습니다.</b> 게다가 통과 구간이 좁아 처음 등록하는
 * 사람이 맞추기 어려웠습니다.
 *
 * <p>지금은 <b>"아까와 달라졌는가" 만 봅니다.</b> 가까이 와도, 물러나도, 살짝 기울여도
 * 통과합니다 — 지시문은 <b>권유</b>일 뿐이고 판정은 변화량입니다. 품질 게이트가 허용하는
 * 범위 안에서만 달라지므로 두 안내가 부딪히지 않습니다.
 *
 * <p>⚠️ 게이트 검표도 같은 품질 게이트를 쓰므로 <b>현장에서 찍히는 얼굴은 늘 정면 근처</b>
 * 입니다. 크게 돌려 등록해 두면 현장에서 만날 일 없는 자세를 평균에 섞는 셈이라,
 * 방향을 시키지 않는 것이 정확도에도 낫습니다.
 */
export interface CaptureStep {
  /** 화면에 띄울 권유. 판정 기준이 아닙니다 */
  prompt: string;
  /** 아직 못 맞췄을 때 보여줄 한 줄 */
  hint?: string;
  /**
   * 찍어도 되는가.
   *
   * @param pose  지금 프레임의 자세
   * @param taken 이번 세션에서 이미 찍은 자세들
   */
  check?: (pose: FacePose, taken: readonly FacePose[]) => boolean;
}

/** 첫 장은 정면이어야 합니다 — 나머지가 여기서 얼마나 달라졌는지로 판정되기 때문입니다 */
const FRONTAL_YAW = 0.06;
const FRONTAL_ROLL = 0.08;

/*
 * 자세를 세 축으로 보고 "달라졌는가" 를 재는 기준.
 *
 * 축마다 단위가 달라서(폭은 비율, 각도는 라디안) 그대로 더할 수 없습니다.
 * 각 축을 **품질 게이트가 허용하는 폭**으로 나눠 0~1 로 맞춘 뒤 가장 큰 변화를 봅니다 —
 * 한 축만 확실히 움직여도 통과하게 하려는 것입니다. 세 축을 합치면 "조금씩 세 번"
 * 움직여야 해서 오히려 어려워집니다.
 */
const SIZE_RANGE = 0.28; // 얼굴 폭 0.32(게이트 하한) ~ 0.6 쯤
const YAW_RANGE = 0.36; // 0.5 ± MAX_YAW_SKEW(0.18)
const ROLL_RANGE = 0.42; // ± MAX_ROLL_RAD(0.21)

/**
 * 이만큼은 달라져야 다음 장으로 봅니다.
 *
 * <p>0.12 는 <b>얼굴 폭이 0.034 쯤 바뀌는 정도</b>(살짝 기대거나 물러나기), 또는
 * <b>고개를 3도쯤 기울이는 정도</b>입니다. 한 동작으로 넘길 수 있게 잡았습니다.
 *
 * <p>🔴 <b>더 올리지 마세요.</b> 0.15 로 해봤더니 얼굴 폭 0.04 변화가 0.143 으로
 * <b>간신히 떨어졌습니다</b> — 사람은 분명히 움직였는데 화면이 안 찍히는, 이 기능이
 * 고치려던 바로 그 상황입니다. 반대로 0.10 아래로 내리면 가만히 서 있어도
 * 손떨림(폭 기준 0.02 쯤)으로 통과해 같은 프레임이 쌓입니다.
 */
const MIN_CHANGE = 0.12;

/** 이미 찍은 자세 <b>전부</b>와 이만큼 달라졌는가 */
function movedEnough(pose: FacePose, taken: readonly FacePose[]): boolean {
  return taken.every((previous) => {
    const change = Math.max(
      Math.abs(pose.size - previous.size) / SIZE_RANGE,
      Math.abs(pose.yaw - previous.yaw) / YAW_RANGE,
      Math.abs(pose.roll - previous.roll) / ROLL_RANGE,
    );
    return change >= MIN_CHANGE;
  });
}

/**
 * 얼굴 등록 — 4장.
 *
 * <p>사용자가 앱에서 <b>한 번만</b> 하는 일이라 짧게 잡았습니다. 첫 장으로 정면을 잡고,
 * 나머지 셋은 <b>조금씩 움직이기만</b> 하면 됩니다.
 *
 * <p>🔴 <b>안경을 벗으라는 단계는 두지 않습니다.</b> 등록할 때 안경을 쓴 사람은 입장할 때도
 * 대개 쓰고 옵니다. 안경 유무는 <b>서로 다른 갈래</b>라 평균에 섞으면 양쪽 다 어중간해집니다
 * ({@code centroidOf} 주석). 쓴 사람은 쓴 채로 찍습니다.
 */
export const REGISTER_STEPS: readonly CaptureStep[] = [
  {
    prompt: '정면을 봐주세요',
    hint: '얼굴을 원 안에 맞추고 똑바로 봐주세요',
    check: (p) => Math.abs(p.yaw - 0.5) < FRONTAL_YAW && Math.abs(p.roll) < FRONTAL_ROLL,
  },
  {
    prompt: '조금 가까이 와주세요',
    hint: '얼굴이 원을 채우듯 조금만 더',
    check: movedEnough,
  },
  {
    prompt: '조금 물러나 주세요',
    hint: '아까보다 얼굴이 작아지게',
    check: movedEnough,
  },
  {
    prompt: '고개를 살짝 기울여 주세요',
    hint: '갸웃하듯 조금만 — 어느 쪽이든 괜찮아요',
    check: movedEnough,
  },
];
