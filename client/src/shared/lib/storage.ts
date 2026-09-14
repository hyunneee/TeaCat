/**
 * localStorage 안전 래퍼.
 * 시크릿 모드/용량초과/직렬화 실패로 앱 전체가 죽는 걸 막습니다.
 */
function createStorage(backend: () => Storage) {
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const raw = backend().getItem(key);
        return raw === null ? fallback : (JSON.parse(raw) as T);
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown): void {
      try {
        backend().setItem(key, JSON.stringify(value));
      } catch {
        /* 조용히 무시 */
      }
    },
    remove(key: string): void {
      try {
        backend().removeItem(key);
      } catch {
        /* 조용히 무시 */
      }
    },
  };
}

export const local = createStorage(() => window.localStorage);
export const session = createStorage(() => window.sessionStorage);

/** 저장 키는 여기서 한 번에 관리 (오타/중복 방지) */
export const STORAGE_KEY = {
  AUTH: 'ticket.auth',
  RECENT_CONCERTS: 'ticket.recentConcerts',
  THEME: 'ticket.theme',
  /** 분석 쿠키 동의 (consent.ts). 없으면 '아직 안 물어봄' 입니다 */
  CONSENT: 'ticket.consent',
} as const;
