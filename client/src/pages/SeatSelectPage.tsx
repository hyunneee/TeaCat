import { Navigate, useParams } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button, LiveDot, Stepper } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { BOOKING_STEPS, ROUTES } from '@/shared/constants';
import { env } from '@/shared/config';
import {
  SeatLegend,
  SeatMap,
  SelectedSeatBar,
  useBookingPolicy,
  useBookingStore,
  useSeatHold,
  useSeatSelection,
  useSectionSeats,
} from '@/features/booking';
import { useSchedule } from '@/features/concert';

/**
 * 좌석 선택 — 이 프로젝트의 폴더 구조 참고 예시입니다.
 *
 * 페이지가 하는 일은 딱 네 가지뿐입니다.
 *   1) URL 파라미터 꺼내기  2) feature 훅 호출  3) 로딩/에러 분기  4) 컴포넌트 배치
 * API 호출도, 좌석 선택 규칙도, 락 처리도 이 파일에는 없습니다.
 *
 * ⚠️ 이 화면에는 지연을 만드는 애니메이션을 넣지 않습니다. 속도가 곧 UX 입니다.
 */
export function SeatSelectPage() {
  const { scheduleId = '' } = useParams();
  const sectionId = useBookingStore((s) => s.sectionId);

  const { section, seats, isPending, isError } = useSectionSeats(scheduleId, sectionId);

  /* 1인 최대 매수는 회차가 아니라 **공연** 단위 정책이라 concertId 가 필요합니다.
     회차 상세에서 얻어 정책을 조회하고, 아직 없으면 배포 환경 기본값을 씁니다. */
  const { data: schedule } = useSchedule(scheduleId);
  const { data: policy } = useBookingPolicy(schedule ? String(schedule.concertId) : undefined);
  const maxPerUser = policy?.maxTicketsPerUser ?? env.maxTicketsPerUser;

  const { selectedSeatIds, select, count } = useSeatSelection(maxPerUser);
  const { holdSeats, isHolding } = useSeatHold(scheduleId);

  // 구역을 안 고르고 직접 URL 로 들어온 경우
  if (!sectionId) return <Navigate to={ROUTES.BOOKING_SECTION(scheduleId)} replace />;

  if (isPending) return <PageLoader />;
  if (isError) {
    return (
      <>
        <Header title="좌석 선택" showBack />
        <EmptyState icon={TriangleAlert} title="좌석 정보를 불러오지 못했어요" />
      </>
    );
  }

  const selectedSeats = seats.filter((s) => selectedSeatIds.includes(s.id));

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        title={section?.name ?? '좌석 선택'}
        showBack
        right={
          <span className="text-subtle mr-2 flex items-center gap-1.5 text-xs font-medium">
            <LiveDot />
            실시간
          </span>
        }
      />
      <Stepper steps={BOOKING_STEPS} current={2} />

      {/* 좌석맵 */}
      {/* 🔴 flex 여야 안쪽 좌석맵이 이 자리를 다 씁니다. flex-1 만 주면
          자식의 h-full(퍼센트 높이)이 auto 로 무너져 좌석맵이 얇은 띠가 됩니다. */}
      <div className="flex min-h-0 flex-1 px-2">
        <SeatMap seats={seats} selectedSeatIds={selectedSeatIds} onSelect={select} />
      </div>

      <div className="px-4">
        <SeatLegend />
        <BottomBar.Spacer className="h-[calc(9rem+env(safe-area-inset-bottom))]" />
      </div>

      <BottomBar className="space-y-3">
        <SelectedSeatBar
          seats={selectedSeats}
          sectionName={section?.name ?? ''}
          maxPerUser={maxPerUser}
          onRemove={select}
        />
        <Button
          variant="dark"
          size="lg"
          fullWidth
          // 중복 요청 1차 방어: 요청 중에는 아예 못 누릅니다.
          disabled={count === 0}
          loading={isHolding}
          onClick={holdSeats}
        >
          {count > 0 ? `${count}석 선택하고 다음` : '좌석을 선택하세요'}
        </Button>
      </BottomBar>
    </div>
  );
}
