export const DURATION_OPTIONS = [
  { value: '30', label: '30분' },
  { value: '60', label: '1시간' },
  { value: '360', label: '6시간' },
  { value: 'custom', label: '직접 선택' },
] as const;
export type DurationOption = (typeof DURATION_OPTIONS)[number]['value'];
export const DEFAULT_DURATION_MINUTES: DurationOption = '60';

export function resolveDurationMinutes(option: DurationOption, hours: string, minutes: string) {
  if (option !== 'custom') return Number(option);
  if (!/^\d+$/.test(hours) || !/^\d+$/.test(minutes)) return null;
  const total = Number(hours) * 60 + Number(minutes);
  return Number(minutes) < 60 && Number.isSafeInteger(total) && total >= 30 && total <= 10080
    ? total
    : null;
}

export const BID_PERIODS = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '오늘' },
  { value: '7', label: '최근 7일' },
  { value: '30', label: '최근 30일' },
  { value: 'custom', label: '직접 선택' },
] as const;
export type BidPeriod = (typeof BID_PERIODS)[number]['value'];
export interface BidDateFilter {
  from?: string;
  to?: string;
}

export function kstDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

export function presetBidDates(period: BidPeriod, now = new Date()): BidDateFilter {
  if (period === 'all') return {};
  const to = kstDate(now);
  const days = period === '7' ? 7 : period === '30' ? 30 : 1;
  return { from: new Date(Date.parse(to) - (days - 1) * 86400000).toISOString().slice(0, 10), to };
}

export function bidDateError({ from, to }: BidDateFilter): string | null {
  if (from === undefined && to === undefined) return null;
  const valid = (value: string | undefined) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
  };
  if (!valid(from) || !valid(to)) return '시작일과 종료일을 올바르게 입력해 주세요.';
  return from! > to! ? '종료일은 시작일과 같거나 이후여야 해요.' : null;
}
