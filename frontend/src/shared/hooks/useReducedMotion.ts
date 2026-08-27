import { useMediaQuery } from './useMediaQuery';

/**
 * 사용자가 OS 설정에서 "동작 줄이기" 를 켰는지.
 * 켜져 있으면 애니메이션을 생략하세요. (CLAUDE.md 4-5)
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
