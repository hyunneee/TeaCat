import { CalendarPlus, Repeat, ScanFace, UserCheck, Users } from 'lucide-react';
import {
  BentoGrid,
  MemberTrendSection,
  StatTile,
  useMemberSummary,
  useMemberTrend,
} from '@/features/admin';

/**
 * 운영 통계 (ADMIN 전용).
 *
 * 페이지는 조립만 합니다 — 훅 호출 → 컴포넌트 배치 (CLAUDE.md 3-6).
 *
 * 🔴 지금 있는 것은 **회원 지표**뿐입니다. 예매·결제·캣머니 지표를 붙일 때는
 *    서버에 `/admin/analytics/<주제>` 를 하나 더 만들고 여기에 구역을 추가하세요.
 *    한 응답에 다 넣으면 화면 하나 열 때마다 무거운 쿼리를 전부 돌립니다.
 */
export function AdminAnalyticsPage() {
  const { data: summary } = useMemberSummary();
  const { data: trend, isPending, range, setRange } = useMemberTrend();

  /* 비율은 화면에서 계산합니다 (서버는 분자·분모만 줍니다).
     분모가 0 일 때 NaN 이 그대로 그려지지 않게 undefined 로 둡니다. */
  const percent = (part: number, whole: number) =>
    whole === 0 ? undefined : Math.round((part / whole) * 100);

  const activeDelta =
    summary && summary.activeYesterday > 0
      ? summary.activeToday - summary.activeYesterday
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-ink text-lg font-bold">운영 통계</h1>
        <p className="text-ink-muted text-sm">
          일반 회원(USER) 기준입니다. 운영진 계정의 접속·가입은 세지 않습니다.
        </p>
      </div>

      <BentoGrid>
        <StatTile
          label="오늘 접속자"
          value={summary?.activeToday}
          unit="명"
          icon={UserCheck}
          caption={
            activeDelta === undefined
              ? '어제와 비교할 기록이 아직 없어요'
              : `어제보다 ${activeDelta >= 0 ? '+' : ''}${activeDelta}명`
          }
        />
        <StatTile
          label="최근 7일 순 접속자"
          value={summary?.weeklyActiveUsers}
          unit="명"
          icon={Users}
          caption={`최근 30일 ${summary?.monthlyActiveUsers ?? '—'}명`}
        />
        <StatTile
          label="재방문율"
          value={
            summary && percent(summary.weeklyReturningUsers, summary.weeklyActiveUsers)
          }
          unit="%"
          icon={Repeat}
          caption="최근 7일 접속자 중 그 전에도 왔던 사람"
        />
        <StatTile
          label="최근 7일 가입"
          value={summary?.signupsLast7Days}
          unit="명"
          icon={CalendarPlus}
          caption={`같은 기간 탈퇴 ${summary?.withdrawalsLast7Days ?? '—'}명`}
        />

        <StatTile
          label="전체 회원"
          value={summary?.totalMembers}
          unit="명"
          icon={Users}
          span={6}
        />
        <StatTile
          label="얼굴 등록 전환율"
          value={summary && percent(summary.faceRegistered, summary.totalMembers)}
          unit="%"
          icon={ScanFace}
          span={6}
          caption={`${summary?.faceRegistered ?? '—'}명 등록 · 티켓 사용(입장)의 전제 조건`}
        />
      </BentoGrid>

      <MemberTrendSection
        trend={trend}
        isPending={isPending}
        range={range}
        onRangeChange={setRange}
      />
    </div>
  );
}
