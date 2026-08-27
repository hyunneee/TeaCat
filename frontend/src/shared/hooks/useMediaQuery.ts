import { useSyncExternalStore } from 'react';

/** useMediaQuery('(min-width: 768px)') */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false, // SSR/초기 렌더 기본값
  );
}
