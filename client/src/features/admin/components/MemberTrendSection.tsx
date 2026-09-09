import type { ReactNode } from 'react';
import { CalendarPlus, TrendingUp, UserCheck, type LucideIcon } from 'lucide-react';
import { Card, Segmented, Skeleton } from '@/shared/components/ui';
import { TrendLineChart, type TrendMarker } from './TrendLineChart';
import { TREND_RANGES, TREND_RANGE_LABEL, type TrendRange } from '../model/adminAnalytics.types';
import type { MemberTrend } from '../model/adminAnalytics.types';

/**
 * 회원 추이 차트 묶음 (View 레이어).
 *
 * 세 장을 한 컴포넌트에 두는 이유는 **셋이 같은 x 축을 공유**하기 때문입니다.
 * 기간을 따로 고를 수 있게 만들면 나란히 놓고 비교할 수가 없습니다.
 */

const RANGE_OPTIONS = TREND_RANGES.map((days) => ({
  value: String(days),
  label: TREND_RANGE_LABEL[days],
}));

/**
 * 같은 날 배포가 여러 번이면 마커는 한 개, 설명만 이어 붙입니다.
 * 세로선을 겹쳐 그으면 굵은 선 하나로 보여서 오히려 몇 번인지 알 수 없습니다.
 */
function toMarkers(trend: MemberTrend): TrendMarker[] {
  const byDate = new Map<string, string[]>();

  for (const deployment of trend.deployments) {
    const date = deployment.deployedAt.slice(0, 10);
    const time = deployment.deployedAt.slice(11, 16);
    const text = `${time} ${deployment.summary ?? deployment.commitHash}`;

    byDate.set(date, [...(byDate.get(date) ?? []), text]);
  }

  return [...byDate].map(([date, texts]) => ({ date, label: texts.join('\n') }));
}

/**
 * 접속자 계열만 특별히 다룹니다.
 *
 * 🔴 집계를 시작하기 전 날짜는 서버가 0 을 주지만 그건 "아무도 안 왔다" 가 아니라
 *    **"재지 않았다"** 입니다. 0 으로 그리면 서비스가 죽어 있던 것처럼 보입니다.
 *    `null` 로 바꿔 선을 끊습니다 (TrendLineChart 의 connectNulls={false}).
 */
function toActivePoints(trend: MemberTrend): { date: string; activeUsers: number | null }[] {
  const trackedFrom = trend.activeUsersTrackedFrom;

  return trend.points.map((point) => ({
    date: point.date,
    activeUsers: trackedFrom && point.date >= trackedFrom ? point.activeUsers : null,
  }));
}

export interface MemberTrendSectionProps {
  trend: MemberTrend | undefined;
  isPending: boolean;
  range: TrendRange;
  onRangeChange: (range: TrendRange) => void;
}

export function MemberTrendSection({
  trend,
  isPending,
  range,
  onRangeChange,
}: MemberTrendSectionProps) {
  const markers = trend ? toMarkers(trend) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-ink-muted text-xs">
          {trend ? `${trend.from} ~ ${trend.to}` : '기간을 불러오는 중'}
          {markers.length > 0 && ' · 점선은 운영 배포 시점입니다'}
        </p>
        <Segmented
          options={RANGE_OPTIONS}
          value={String(range)}
          onChange={(value) => onRangeChange(Number(value) as TrendRange)}
          className="w-48"
        />
      </div>

      <ChartCard
        title="하루 접속자"
        icon={UserCheck}
        caption={
          trend?.activeUsersTrackedFrom
            ? `한 사람당 하루 한 번으로 셉니다. ${trend.activeUsersTrackedFrom}부터 집계했습니다`
            : '아직 집계된 접속 기록이 없습니다. 이 기능을 배포한 날부터 쌓입니다'
        }
        isPending={isPending}
      >
        {trend && (
          <TrendLineChart
            data={toActivePoints(trend)}
            series={[
              { key: 'activeUsers', label: '접속자', color: 'var(--color-accent-700)' },
            ]}
            markers={markers}
            unit="명"
          />
        )}
      </ChartCard>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard
          title="가입·탈퇴"
          icon={CalendarPlus}
          caption="가입은 나중에 탈퇴했더라도 그날 가입한 것으로 셉니다"
          isPending={isPending}
        >
          {trend && (
            <TrendLineChart
              data={trend.points}
              series={[
                { key: 'signups', label: '가입', color: 'var(--color-accent-700)' },
                {
                  key: 'withdrawals',
                  label: '탈퇴',
                  color: 'var(--color-brand-400)',
                  dashed: true,
                },
              ]}
              markers={markers}
              unit="명"
            />
          )}
        </ChartCard>

        <ChartCard
          title="누적 회원"
          icon={TrendingUp}
          caption="그날 자정 기준이고 탈퇴한 회원은 빠져 있습니다"
          isPending={isPending}
        >
          {trend && (
            <TrendLineChart
              data={trend.points}
              series={[
                { key: 'totalMembers', label: '누적 회원', color: 'var(--color-brand-600)' },
              ]}
              markers={markers}
              unit="명"
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  caption: string;
  icon: LucideIcon;
  isPending: boolean;
  children: ReactNode;
}

function ChartCard({ title, caption, icon: Icon, isPending, children }: ChartCardProps) {
  return (
    <Card padded>
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-ink-subtle shrink-0" aria-hidden />
        <h2 className="text-ink text-sm font-semibold">{title}</h2>
      </div>
      <p className="text-ink-subtle mt-1 text-xs">{caption}</p>

      <div className="mt-4">{isPending ? <Skeleton className="h-[220px] w-full" /> : children}</div>
    </Card>
  );
}
