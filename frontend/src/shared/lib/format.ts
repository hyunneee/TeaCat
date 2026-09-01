const KRW = new Intl.NumberFormat('ko-KR');

/** 12000 → '12,000원' */
export function formatPrice(value: number): string {
  return `${KRW.format(value)}원`;
}

/**
 * 포도알 개수 표시. 화면 문구는 항상 "포도알" 입니다 —
 * "토큰"·"포인트" 로 적지 마세요 (내부 식별자만 token 을 씁니다).
 */
export function formatPoints(value: number): string {
  return `${KRW.format(value)}포도알`;
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

/** ISO 문자열 → '2026. 3. 14.' (시각이 필요 없는 목록용) */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(iso));
}

/** 남은 초 → 'MM:SS' (좌석 점유 타이머, 대기열 표시용) */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * 남은 시간을 사람이 읽는 단위로. '8시간 59분' / '12분 30초' / '45초'
 *
 * `formatDuration` 은 좌석 선점(7분)처럼 **분:초** 카운트다운 전용입니다.
 * 12시간짜리 마감에 쓰면 "539:45" 가 되어 아무 의미가 없습니다.
 * 한 시간을 넘는 기한에는 반드시 이걸 쓰세요.
 */
export function formatRemaining(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

/** '홍길동' → '홍*동' (다른 사람에게 보이는 예매자명 마스킹) */
export function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${'*'.repeat(name.length - 2)}${name.at(-1)}`;
}
