import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { EmptyState } from '@/shared/components/common';
import { LineChart as LineChartIcon } from 'lucide-react';

/**
 * 어드민 통계용 꺾은선 그래프 (View 레이어).
 *
 * 🔴 recharts 는 **어드민 화면 전용**입니다 (CLAUDE.md 1장). 사용자 화면에 쓰지 마세요.
 *
 * 색은 디자인 토큰만 씁니다. 선을 구분할 때 색을 늘리는 대신 **점선**을 씁니다 —
 * 이 앱의 팔레트는 무채색 + 초록 하나라(DESIGN.md 1장), 계열마다 색을 뽑으면
 * 강조색이 강조가 아니게 됩니다.
 */

export interface TrendSeries {
  /** data 안의 필드 이름 */
  key: string;
  label: string;
  /** CSS 색. `var(--color-...)` 토큰을 그대로 넣습니다 */
  color: string;
  /** 보조 계열은 점선으로 구분합니다 */
  dashed?: boolean;
}

/** 세로 마커선. 지금은 배포 시점에 씁니다 */
export interface TrendMarker {
  /** 어느 x 값(`2026-09-09`) 위에 세울지 */
  date: string;
  /** 툴팁에 뜨는 설명. 같은 날 여러 건이면 줄바꿈으로 이어 붙여 주세요 */
  label: string;
}

/**
 * 데이터 한 점. `date` 만 있으면 나머지 필드는 자유입니다 — `series[].key` 가 가리키는
 * 필드를 그립니다.
 *
 * 제네릭으로 둔 이유: 서버 응답 타입({@code MemberDailyPoint})을 그대로 넘길 수 있어야
 * 하는데, 인덱스 시그니처를 요구하면 인터페이스로 선언된 응답 타입이 들어가지 않습니다.
 *
 * 값이 `null` 이면 "잰 적 없음" 이라 선이 끊깁니다. **0 과는 다릅니다.**
 */
export interface TrendLineChartProps<T extends { date: string }> {
  data: T[];
  series: TrendSeries[];
  markers?: TrendMarker[];
  /** 숫자 뒤에 붙는 단위 */
  unit?: string;
  height?: number;
}

/** `2026-09-09` → `9/9` */
const shortDate = (date: string) => {
  const [, month, day] = date.split('-');
  return `${Number(month)}/${Number(day)}`;
};

/** `2026-09-09` → `9월 9일` */
const longDate = (date: string) => {
  const [, month, day] = date.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
};

const AXIS_STYLE = { fontSize: 11, fill: 'var(--color-ink-subtle)' } as const;

/** 이 개수 이하로 값이 있으면 점을 찍습니다 (한 달치를 다 찍어도 촘촘하지 않은 선) */
const SPARSE_POINT_LIMIT = 31;

/** 그 계열에 실제 값(널이 아닌 수)이 몇 개인지 */
const countValues = <T,>(data: T[], key: string) =>
  data.filter((point) => typeof (point as Record<string, unknown>)[key] === 'number').length;

export function TrendLineChart<T extends { date: string }>({
  data,
  series,
  markers = [],
  unit = '',
  height = 220,
}: TrendLineChartProps<T>) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="아직 볼 데이터가 없어요"
        description="집계가 쌓이면 여기에 그래프가 그려집니다."
      />
    );
  }

  const markerByDate = new Map(markers.map((marker) => [marker.date, marker.label]));

  /* 제네릭을 좁히지 않습니다 — recharts 의 ContentType 이 기본 제네릭으로 고정돼 있어서
     <number, string> 로 좁히면 대입이 안 됩니다. 값은 아래에서 숫자인지 확인합니다. */
  const renderTooltip = ({ active, label, payload }: TooltipContentProps) => {
    if (!active || !payload?.length || typeof label !== 'string') return null;

    const marker = markerByDate.get(label);

    return (
      <div className="border-line bg-surface-1 shadow-pop rounded-xl border px-3 py-2">
        <p className="text-ink text-xs font-semibold">{longDate(label)}</p>

        <ul className="mt-1.5 flex flex-col gap-0.5">
          {payload.map((entry) => (
            <li key={String(entry.dataKey)} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-ink-muted">{entry.name}</span>
              <span className="text-ink ml-auto font-semibold tabular-nums">
                {/* null 은 잰 적이 없는 구간입니다. 0 으로 보이면 안 됩니다 */}
                {typeof entry.value === 'number'
                  ? `${entry.value.toLocaleString()}${unit}`
                  : '집계 전'}
              </span>
            </li>
          ))}
        </ul>

        {marker && (
          <p
            /* 같은 날 배포가 여러 건이면 줄바꿈으로 넘어옵니다.
               pre-line 이 없으면 한 줄에 붙어서 몇 건인지 알 수 없습니다 */
            className="border-line text-ink-muted mt-2 border-t pt-1.5 text-[11px] leading-snug whitespace-pre-line"
          >
            🚀 {marker}
          </p>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />

        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-line)' }}
          minTickGap={24}
        />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          width={44}
          allowDecimals={false}
        />

        {/* 배포 마커. 축보다 먼저 그려야 선 위로 튀지 않습니다 */}
        {[...markerByDate.keys()].map((date) => (
          <ReferenceLine
            key={date}
            x={date}
            stroke="var(--color-ink-subtle)"
            strokeDasharray="4 4"
          />
        ))}

        <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--color-line)' }} />

        {series.map(({ key, label, color, dashed }) => (
          <Line
            key={key}
            /* 🔴 곡선(monotone)을 쓰지 않습니다. 하루 단위 값이라 날짜와 날짜 사이에는
                  아무 데이터도 없는데, 부드럽게 이으면 0 이었던 어제부터 이미 올라가는
                  것처럼 보이고 봉우리도 실제 값보다 높이 솟습니다. */
            type="linear"
            dataKey={key}
            name={label}
            stroke={color}
            strokeWidth={2}
            strokeDasharray={dashed ? '5 4' : undefined}
            /* 🔴 점을 늘 끄면 안 됩니다. 값이 하나뿐이거나 앞뒤가 null 로 끊긴 날은
                  이을 상대가 없어 선이 안 그려지고, 화면이 통째로 비어 보입니다
                  (집계를 막 시작했을 때가 정확히 그 상황입니다).
                  값이 몇 개 없을 때만 점을 찍습니다 — 90일치에 점을 다 찍으면 지저분합니다. */
            dot={countValues(data, key) <= SPARSE_POINT_LIMIT ? { r: 2.5 } : false}
            activeDot={{ r: 3 }}
            /* 끊어야 할 곳(잰 적 없는 구간)에서 이어 붙이면 없는 데이터를 있는 것처럼 그립니다 */
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
