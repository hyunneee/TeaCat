import type { AppVersionInfo, UpdateState } from './appInfo.types';

/**
 * 버전 비교 (순수 함수).
 *
 * 문자열 비교(`'0.10.0' > '0.9.0'`)는 **거짓**입니다 — 자리수를 나눠 숫자로 비교해야 합니다.
 * 이 실수는 배포하고 나서야 드러나므로 여기 한 곳에 모아둡니다.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      // '1.2.0-beta.1' 처럼 뒤에 붙는 건 비교에서 제외합니다
      .split('-')[0]!
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/** 지금 쓰는 버전이 어떤 상태인가 */
export function updateStateOf(current: string, info: AppVersionInfo | undefined): UpdateState {
  if (!info) return 'UNKNOWN';
  if (compareVersions(current, info.minimum) < 0) return 'REQUIRED';
  if (compareVersions(current, info.latest) < 0) return 'OUTDATED';
  return 'CURRENT';
}

export const UPDATE_STATE_LABEL: Record<UpdateState, string> = {
  CURRENT: '최신 버전입니다',
  OUTDATED: '새 버전이 있어요',
  REQUIRED: '업데이트가 필요해요',
  UNKNOWN: '버전 정보를 확인하지 못했어요',
};
