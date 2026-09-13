import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Armchair, TriangleAlert } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button, LiveDot, Stepper } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { BOOKING_STEPS, ROUTES } from '@/shared/constants';
import { env } from '@/shared/config';
import { useModal } from '@/app/providers';
import {
  HeldSeatNotice,
  SeatLegend,
  SeatMap,
  SelectedSeatBar,
  useBookingPolicy,
  useBookingStore,
  useResumeHold,
  useSeatHold,
  useSeatSelection,
  sectionBlockedReason,
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
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams();
  const { open } = useModal();
  const sectionId = useBookingStore((s) => s.sectionId);

  const { data: seatMap, section, seats, isPending, isError } = useSectionSeats(scheduleId, sectionId);
  const hold = useBookingStore((s) => s.hold);

  // 서버에만 남아 있는 선점 되살리기 (SectionSelectPage 주석 참고)
  useResumeHold(scheduleId);

  /* 1인 최대 매수는 회차가 아니라 **공연** 단위 정책이라 concertId 가 필요합니다.
     회차 상세에서 얻어 정책을 조회하고, 아직 없으면 배포 환경 기본값을 씁니다. */
  const { data: schedule } = useSchedule(scheduleId);
  const { data: policy } = useBookingPolicy(schedule ? String(schedule.concertId) : undefined);
  const maxPerUser = policy?.maxTicketsPerUser ?? env.maxTicketsPerUser;

  const { selectedSeatIds, select, count } = useSeatSelection(maxPerUser);
  const { holdSeats, isHolding, remainSeconds, releaseHold, isReleasing } = useSeatHold(scheduleId);

  /* 자리를 놓으면 남이 바로 가져갈 수 있어 되돌릴 수 없습니다 → 붉은 확인 모달 (CLAUDE.md 4-7) */
  const confirmRelease = () =>
    open('common/confirm', {
      title: '잡아둔 자리를 놓을까요?',
      message: '자리가 바로 풀려서 다른 분이 가져갈 수 있어요. 되돌릴 수 없습니다.',
      confirmText: '놓기',
      danger: true,
      onConfirm: releaseHold,
    });

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

  // 스탠딩은 구역 선택 화면에서 서버 자동 배정 후 확인 단계로 바로 이동한다.
  // 향후 다매 구매 UI는 StandingQuantitySelector.tsx에 렌더링하지 않는 코드로 보존한다.
  if (section?.type === 'STANDING') {
    return <Navigate to={ROUTES.BOOKING_SECTION(scheduleId)} replace />;
  }

  /* 고를 수 있는 좌석이 하나도 없으면 이유를 말해 줍니다.
     🔴 이걸 안 하면 회색 좌석만 잔뜩 그려 놓고 눌러도 아무 반응이 없는 화면이 됩니다 —
        "좌석이 안 눌린다" 는 신고가 여기서 나옵니다. 구역 화면에서 이미 막고 있지만,
        폴링 도중 매진되거나 예전에 골라둔 구역으로 되돌아오는 길도 있어 여기서도 막습니다. */
  const blockedReason = section ? sectionBlockedReason(section) : null;
  if (blockedReason) {
    return (
      <>
        <Header title={section?.name ?? '좌석 선택'} showBack />
        <EmptyState
          icon={Armchair}
          title={blockedReason}
          description="다른 구역을 골라 보세요."
          action={
            <Button variant="dark" onClick={() => navigate(ROUTES.BOOKING_SECTION(scheduleId))}>
              구역 다시 고르기
            </Button>
          }
        />
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

      {/* 결제까지 갔다가 돌아온 경우 — 잡아둔 자리를 알려주고 이어가기·놓기 길을 함께 줍니다.
          안내만 있으면 그 자리로 돌아갈 방법이 없어 막다른 길이 됩니다 */}
      {hold && (
        <div className="px-4 pb-2">
          <HeldSeatNotice
            hold={hold}
            seatMap={seatMap}
            remainSeconds={remainSeconds}
            onContinue={() => navigate(ROUTES.BOOKING_REVIEW(scheduleId))}
            onRelease={confirmRelease}
            releasing={isReleasing}
          />
        </div>
      )}

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
