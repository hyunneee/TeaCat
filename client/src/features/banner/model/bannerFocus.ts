import type { BannerImageFocus } from './banner.types';

/**
 * 배너 그림에서 **어디를 남길지**.
 *
 * 배너 틀은 폰 4:3, 데스크톱 2:1 입니다. 올린 그림이 그 비율이 아니면 `object-cover` 가
 * 남는 쪽을 잘라내는데, 기본값인 가운데가 늘 정답은 아닙니다 — 얼굴이 위쪽에 있는
 * 3:4 포스터를 2:1 로 자르면 가운데만 남아 목부터 보입니다. 그래서 관리자가 그림을
 * **끌어서** 맞춥니다 (`features/admin` 의 `BannerFocusPicker`).
 *
 * 값은 CSS `object-position` 으로 그대로 옮깁니다 — 0 이 왼쪽/위 끝, 50 이 가운데,
 * 100 이 오른쪽/아래 끝입니다.
 *
 * 🔴 예전에는 아홉 칸 중 하나를 고르는 값이었습니다. 끌어서 맞추려면 값이 **이어져
 *    있어야** 해서 점으로 바꿨습니다 (서버 마이그레이션 `V20260922_1100`).
 *    아홉 칸으로는 끄는 대로 따라오지 못하고 가장 가까운 칸으로 튑니다.
 *
 * 🔴 여기는 `model/` 이라 React 를 모릅니다. 끌어서 고르는 UI 는 어드민 쪽에 있고
 *    이 표만 배럴로 가져다 씁니다.
 */

/** 그림을 옮길 수 있는 범위(%) */
export const FOCUS_MIN = 0;
export const FOCUS_MAX = 100;

/** 고르지 않았을 때. 지금까지 보이던 것과 같아야 기존 배너가 갑자기 바뀌지 않습니다 */
export const DEFAULT_BANNER_FOCUS: BannerImageFocus = { x: 50, y: 50 };

export function clampFocus(value: number): number {
  return Math.min(FOCUS_MAX, Math.max(FOCUS_MIN, Math.round(value)));
}

/**
 * CSS `object-position` 값.
 *
 * 값이 없을 수도 있습니다 — 이 칸을 모르는 서버(구버전)가 응답에서 빼고 줄 수 있어서,
 * 그때는 지금까지와 같은 가운데로 둡니다. 배너가 통째로 안 보이는 것보다 낫습니다.
 */
export function objectPositionOf(x: number | null | undefined, y: number | null | undefined): string {
  const px = clampFocus(x ?? DEFAULT_BANNER_FOCUS.x);
  const py = clampFocus(y ?? DEFAULT_BANNER_FOCUS.y);
  return `${px}% ${py}%`;
}

/** 서버가 평평하게 주는 두 칸 → 화면이 다루기 좋은 한 점 */
export function focusOf(
  x: number | null | undefined,
  y: number | null | undefined,
): BannerImageFocus {
  return {
    x: clampFocus(x ?? DEFAULT_BANNER_FOCUS.x),
    y: clampFocus(y ?? DEFAULT_BANNER_FOCUS.y),
  };
}
