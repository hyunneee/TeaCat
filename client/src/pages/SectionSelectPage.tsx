import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Hourglass, TriangleAlert } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button, Stepper } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { BOOKING_STEPS, ROUTES } from '@/shared/constants';
import {
  HeldSeatNotice,
  SectionGrid,
  VenueMap,
  VenueMapLegend,
  useBookingStore,
  useSeatHold,
  useSeatMap,
  useSections,
} from '@/features/booking';
import { useConcertLayout, useSchedule } from '@/features/concert';
import { useModal } from '@/app/providers';

/** 플로우: 봇 확인 → **구역** → 좌석 선택 */
export function SectionSelectPage() {
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams();
  const { open } = useModal();

  const startSession = useBookingStore((s) => s.startSession);
  const sectionId = useBookingStore((s) => s.sectionId);
  const selectSection = useBookingStore((s) => s.selectSection);

  useEffect(() => startSession(scheduleId), [scheduleId, startSession]);

  const { data: schedule } = useSchedule(scheduleId);
  const { data: sections, isPending, isError } = useSections(scheduleId);
  const { data: seatMap } = useSeatMap(scheduleId);
  const hold = useBookingStore((s) => s.hold);
  const { remainSeconds, releaseHold, isReleasing } = useSeatHold(scheduleId);
  /* 배치도(도면 크기 + 기둥·출입구)는 좌석맵에 없어 따로 부릅니다.
     실패해도 화면은 그려집니다 — VenueMap 이 구역만으로 좌표계를 잡습니다 */
  const { data: layout } = useConcertLayout(schedule ? String(schedule.concertId) : undefined);

  /* 자리를 놓으면 남이 바로 가져갈 수 있어 되돌릴 수 없습니다 → 붉은 확인 모달 (CLAUDE.md 4-7) */
  const confirmRelease = () =>
    open('common/confirm', {
      title: '잡아둔 자리를 놓을까요?',
      message: '자리가 바로 풀려서 다른 분이 가져갈 수 있어요. 되돌릴 수 없습니다.',
      confirmText: '놓기',
      danger: true,
      onConfirm: releaseHold,
    });

  if (isPending) return <PageLoader />;
  if (isError || !sections) {
    return (
      <>
        <Header title="구역 선택" showBack />
        <EmptyState icon={TriangleAlert} title="구역 정보를 불러오지 못했어요" />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={schedule?.concertTitle ?? '구역 선택'} showBack />
      <Stepper steps={BOOKING_STEPS} current={1} />

      <div className="flex-1 space-y-4 p-4 pt-1">
        <div>
          <h2 className="font-bold">구역을 선택하세요</h2>
          <p className="text-muted mt-0.5 text-xs">
            무대를 기준으로 구역이 어디인지 확인하고 고르세요.
          </p>
        </div>

        {/* 결제까지 갔다가 돌아온 경우 — 쥔 자리로 되돌아가거나 놓을 길을 함께 줍니다.
            다른 구역을 그냥 골라도 되지만, 그때는 쥔 자리가 풀린다는 걸 미리 알려야 합니다 */}
        <HeldSeatNotice
          hold={hold}
          seatMap={seatMap}
          remainSeconds={remainSeconds}
          onContinue={() => navigate(ROUTES.BOOKING_REVIEW(scheduleId))}
          onRelease={confirmRelease}
          releasing={isReleasing}
        />

        <VenueMap
          sections={sections}
          selectedId={sectionId}
          onSelect={(s) => selectSection(s.id)}
          layout={layout}
        />

        <VenueMapLegend layout={layout} />

        <SectionGrid sections={sections} selectedId={sectionId} onSelect={(s) => selectSection(s.id)} />

        {/* 취소표 추첨 대기 진입 (플로우차트: 구역 → 취소표 예약대기) */}
        <button
          type="button"
          onClick={() => navigate(ROUTES.RESALE(scheduleId))}
          className="surface shadow-card hover:bg-surface-2 flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors"
        >
          <Hourglass size={20} className="text-ink-muted shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">원하는 자리가 없나요?</span>
            <span className="text-muted block text-xs">
              취소표가 나오면 대기자 중에서 무작위로 뽑아 드려요.
            </span>
          </span>
        </button>

        <BottomBar.Spacer />
      </div>

      <BottomBar>
        <Button
          variant="dark"
          size="lg"
          fullWidth
          disabled={!sectionId}
          onClick={() => navigate(ROUTES.BOOKING_SEATS(scheduleId))}
        >
          좌석 선택하기
        </Button>
      </BottomBar>
    </div>
  );
}
