const KRW = new Intl.NumberFormat('ko-KR');

/** 12000 → '12,000원' */
export function formatPrice(value: number): string {
  return `${KRW.format(value)}원`;
}

/** ISO 문자열 → '2026. 3. 14. (토) 19:00' */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** 남은 초 → 'MM:SS' (좌석 점유 타이머, 대기열 표시용) */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** '홍길동' → '홍*동' (다른 사람에게 보이는 예매자명 마스킹) */
export function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${'*'.repeat(name.length - 2)}${name.at(-1)}`;
}
