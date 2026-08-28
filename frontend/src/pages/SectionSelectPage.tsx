import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Dices, TriangleAlert } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button, Stepper } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { BOOKING_STEPS, ROUTES } from '@/shared/constants';
import { SectionGrid, VenueMap, useBookingStore, useSections } from '@/features/booking';
import { useSchedule } from '@/features/concert';

/** 플로우: 봇 확인 → **구역** → 좌석 선택 */
export function SectionSelectPage() {
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams();

  const startSession = useBookingStore((s) => s.startSession);
  const sectionId = useBookingStore((s) => s.sectionId);
  const selectSection = useBookingStore((s) => s.selectSection);

  useEffect(() => startSession(scheduleId), [scheduleId, startSession]);

  const { data: schedule } = useSchedule(scheduleId);
  const { data: sections, isPending, isError } = useSections(scheduleId);

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

        <VenueMap
          sections={sections}
          selectedId={sectionId}
          onSelect={(s) => selectSection(s.id)}
        />

        <SectionGrid sections={sections} selectedId={sectionId} onSelect={(s) => selectSection(s.id)} />

        {/* 취소표 추첨 대기 진입 (플로우차트: 구역 → 취소표 예약대기) */}
        <button
          type="button"
          onClick={() => navigate(ROUTES.RESALE(scheduleId))}
          className="surface flex w-full items-center gap-3 rounded-xl border border-dashed p-4 text-left transition-colors hover:border-line-strong"
        >
          <Dices size={20} className="text-brand-500 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">원하는 자리가 없나요?</span>
            <span className="text-muted block text-xs">
              취소표 추첨 대기를 신청하면 블록체인 난수로 공정하게 배정됩니다.
            </span>
          </span>
        </button>

        <BottomBar.Spacer />
      </div>

      <BottomBar>
        <Button
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
