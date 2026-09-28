import { ChevronLeft, ChevronRight, PawPrint } from 'lucide-react';
import { Card } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import type { AttendanceCalendar } from '../model/dailyReward.types';

interface Props {
  calendar: AttendanceCalendar | undefined;
  loading?: boolean;
  /** 이 달보다 앞/뒤로 갈 때. YYYY-MM 을 받습니다 */
  onMonthChange: (month: string) => void;
  /** 다음 달 버튼을 잠글지 — 오지 않은 달은 볼 것이 없습니다 */
  atCurrentMonth: boolean;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 출석 달력.
 *
 * 🔴 **날짜를 `new Date()` 로 만들지 않습니다.** 서버가 준 `YYYY-MM-DD` 문자열을 쪼개
 * 씁니다. `new Date('2026-09-01')` 은 UTC 자정으로 읽혀서 한국 시간대에서는 8월 31일이
 * 되고, 달력이 통째로 하루씩 밀립니다. 그래서 문자열끼리만 비교합니다.
 */
export function AttendanceCalendarCard({ calendar, loading, onMonthChange, atCurrentMonth }: Props) {
  if (loading || !calendar) {
    return (
      <Card className="space-y-3">
        <div className="surface-2 h-6 w-32 animate-pulse rounded" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="surface-2 aspect-square animate-pulse rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  const [year, month] = calendar.month.split('-').map(Number);
  const attended = new Set(calendar.days.map((day) => day.date));

  // 그 달 1일이 무슨 요일인지, 며칠까지 있는지. UTC 로 만들어 시간대 영향을 없앱니다
  const firstWeekday = new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay();
  const lastDate = new Date(Date.UTC(year!, month!, 0)).getUTCDate();

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateOf = (day: number) => `${year}-${pad(month!)}-${pad(day)}`;

  function shift(delta: number) {
    const target = new Date(Date.UTC(year!, month! - 1 + delta, 1));
    onMonthChange(`${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}`);
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="surface-2 text-muted flex size-8 items-center justify-center rounded-full"
          aria-label="이전 달"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-bold">
          {year}년 {month}월
        </p>
        <button
          type="button"
          disabled={atCurrentMonth}
          onClick={() => shift(1)}
          className="surface-2 text-muted flex size-8 items-center justify-center rounded-full disabled:opacity-30"
          aria-label="다음 달"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((label) => (
          <div key={label} className="text-subtle text-center text-[11px]">
            {label}
          </div>
        ))}

        {/* 1일이 시작하는 요일까지 빈 칸 */}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {Array.from({ length: lastDate }, (_, i) => {
          const day = i + 1;
          const date = dateOf(day);
          const stamped = attended.has(date);
          const isToday = date === calendar.today;
          return (
            <div
              key={day}
              className={cn(
                'surface-2 relative flex aspect-square items-center justify-center rounded-lg',
                /* 오늘은 아직 안 찍었어도 어디인지 보여야 합니다 */
                isToday && !stamped && 'ring-accent-700 ring-2',
              )}
              aria-label={stamped ? `${day}일 출석 도장` : `${day}일`}
            >
              {/* 🔴 도장이 찍힌 날은 날짜를 **모서리로 비킵니다.** 가운데 그대로 두면
                  발바닥과 숫자가 정확히 겹쳐 둘 다 안 읽힙니다 — 날짜를 지워 버리면
                  달력이 아니라 무늬가 되므로, 지우는 대신 자리를 옮깁니다 */}
              <span
                className={cn(
                  'tabular-nums',
                  stamped
                    ? 'text-subtle absolute top-0.5 left-1 text-[9px]'
                    : 'text-muted text-xs',
                )}
              >
                {day}
              </span>

              {stamped && (
                <PawPrint
                  size={20}
                  strokeWidth={2.5}
                  aria-hidden
                  /* 도장처럼 보이려면 반듯하면 안 됩니다 — 날마다 조금씩 다른 각도로
                     비스듬히 찍힙니다. 날짜에서 각도를 뽑아 새로고침해도 그대로입니다 */
                  className="text-accent-700 pointer-events-none opacity-90"
                  style={{ transform: `rotate(${((day * 37) % 31) - 15}deg)` }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="border-line text-muted flex items-center gap-1 border-t pt-3 text-xs">
        <PawPrint size={12} className="text-accent-700" aria-hidden />
        {/* "이번 달" 이라고 쓰지 않습니다 — 지난 달을 보고 있을 때도 그렇게 읽혀서
            8월 화면에 "이번 달 0일" 이 뜹니다. 보고 있는 달을 그대로 말합니다 */}
        <span className="flex-1">
          {month}월 {calendar.totalDays}일 출석
        </span>
        <span className="tabular-nums">{calendar.totalAmount.toLocaleString()} 캣머니</span>
      </div>
    </Card>
  );
}
