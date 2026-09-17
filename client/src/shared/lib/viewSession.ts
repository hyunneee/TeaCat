const VIEW_SESSION_KEY = 'teacat:view-session';
let memorySessionId: string | null = null;

/** Anonymous identifier scoped to one browser tab. It contains no user or network information. */
export function getViewSessionId(): string {
  try {
    const saved = window.sessionStorage.getItem(VIEW_SESSION_KEY);
    if (saved) return saved;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(VIEW_SESSION_KEY, created);
    return created;
  } catch {
    // Storage가 막혀도 이 탭이 열려 있는 동안은 같은 익명 세션을 재사용합니다.
    memorySessionId ??= crypto.randomUUID();
    return memorySessionId;
  }
}
