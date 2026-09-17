import type { BannerImageFocus } from './banner.types';

/**
 * 배너 그림에서 **어디를 남길지**.
 *
 * 배너 틀은 폰 4:3, 데스크톱 2:1 입니다. 올린 그림이 그 비율이 아니면 `object-cover` 가
 * 남는 쪽을 잘라내는데, 기본값인 가운데가 늘 정답은 아닙니다 — 얼굴이 위쪽에 있는
 * 3:4 포스터를 2:1 로 자르면 가운데만 남아 목부터 보입니다. 그래서 관리자가 고릅니다.
 *
 * 값은 CSS `object-position` 으로 그대로 옮깁니다. 서버 enum 과 이름이 1:1 이라
 * 새 위치를 늘리려면 마이그레이션(`main_banner_image_focus`)부터 고쳐야 합니다.
 *
 * 🔴 여기는 `model/` 이라 React 를 모릅니다. 고르는 UI 는 어드민 쪽에 있고
 *    (`features/admin` 의 배너 폼), 이 표만 배럴로 가져다 씁니다.
 */
const OBJECT_POSITION: Record<BannerImageFocus, string> = {
  TOP_LEFT: 'left top',
  TOP: 'center top',
  TOP_RIGHT: 'right top',
  LEFT: 'left center',
  CENTER: 'center center',
  RIGHT: 'right center',
  BOTTOM_LEFT: 'left bottom',
  BOTTOM: 'center bottom',
  BOTTOM_RIGHT: 'right bottom',
};

/**
 * 3 × 3 로 늘어놓을 순서. 고르는 화면이 이 순서 그대로 격자를 그립니다.
 * (`Record` 는 순서를 약속하지 않으므로 따로 둡니다)
 */
export const BANNER_FOCUS_GRID: readonly BannerImageFocus[] = [
  'TOP_LEFT',
  'TOP',
  'TOP_RIGHT',
  'LEFT',
  'CENTER',
  'RIGHT',
  'BOTTOM_LEFT',
  'BOTTOM',
  'BOTTOM_RIGHT',
];

/** 고르지 않았을 때. 지금까지 보이던 것과 같아야 기존 배너가 갑자기 바뀌지 않습니다 */
export const DEFAULT_BANNER_FOCUS: BannerImageFocus = 'CENTER';

/**
 * CSS `object-position` 값.
 *
 * 값이 없을 수도 있습니다 — 이 칸을 모르는 서버(구버전)가 응답에서 빼고 줄 수 있어서,
 * 그때는 지금까지와 같은 가운데로 둡니다. 배너가 통째로 안 보이는 것보다 낫습니다.
 */
export function objectPositionOf(focus: BannerImageFocus | null | undefined): string {
  return OBJECT_POSITION[focus ?? DEFAULT_BANNER_FOCUS] ?? OBJECT_POSITION[DEFAULT_BANNER_FOCUS];
}
