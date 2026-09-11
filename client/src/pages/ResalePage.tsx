import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Hourglass, Info } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button, Card, Segmented } from '@/shared/components/ui';
import { EmptyState, PageLoader } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { env } from '@/shared/config';
import { canWaitlist, useSchedule } from '@/features/concert';
import { ResaleSectionList, useApplyResale, useResaleSections } from '@/features/resale';

/**
 * 취소표 추첨 대기 신청.
 *
 * 플로우: 구역 → 취소표 대기 신청 → (서버가 추첨) → 당첨 알림 → 12시간 내 예매
 * 선착순이 아니라 추첨이라 새로고침 경쟁이 의미가 없습니다. 그게 이 기능의 목적입니다.
 *
 * 대기는 **매진된 뒤, 매진된 구역에만** 걸 수 있습니다.
 * - 회차가 아직 오픈 전이면 이 화면 자체를 막습니다 (URL 로 직접 들어와도).
 * - 자리가 남은 구역은 목록에서 고를 수 없습니다 — 그건 예매하면 되는 자리입니다.
 */
export function ResalePage() {
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams();

  const [sectionId, setSectionId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');

  const { data: schedule, isPending: schedulePending } = useSchedule(scheduleId);
  const { data: sections, isPending } = useResaleSections(scheduleId);
  const apply = useApplyResale(scheduleId);

  /* 회차 응답에는 매수 제한이 없습니다. 공연 예매 정책(API-205)이 붙으면 그 값을 먼저 쓰세요. */
  const maxPerUser = env.maxTicketsPerUser;
  const quantityOptions = Array.from({ length: maxPerUser }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}매`,
  }));

  /* 회차 정보가 먼저 옵니다. 대기를 받을 수 없는 회차면 구역 목록을 기다리지 않고 바로 안내합니다 */
  if (schedulePending) return <PageLoader />;

  /* 상세 화면의 대기 버튼은 매진일 때만 보이지만, 주소로 바로 들어오는 경우까지 여기서 다시 막습니다 */
  if (schedule && !canWaitlist(schedule)) {
    const beforeOpen = schedule.bookingStatus === 'BEFORE';
    return (
      <>
        <Header title="취소표 추첨 대기" showBack />
        <EmptyState
          icon={Hourglass}
          title={beforeOpen ? '아직 티켓팅이 열리지 않았어요' : '지금은 대기를 받지 않아요'}
          description={
            beforeOpen
              ? '취소표 대기는 티켓팅이 시작되고 구역이 매진된 뒤에 열립니다. 먼저 예매에 참여해 주세요.'
              : schedule.bookingStatus === 'OPEN'
                ? '아직 자리가 남아 있어요. 예매로 바로 구매할 수 있습니다.'
                : '마감된 회차는 취소표가 다시 판매되지 않습니다.'
          }
        />
      </>
    );
  }

  if (isPending) return <PageLoader />;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title="취소표 추첨 대기" showBack />

      <div className="flex-1 space-y-4 p-4">
        <Card className="flex gap-3">
          <Hourglass size={20} className="text-brand-500 shrink-0" />
          <div className="space-y-1 text-xs">
            <p className="text-[0.8125rem] font-bold">먼저 신청해도 유리하지 않아요</p>
            <p className="text-muted leading-relaxed">
              취소표가 나오면 대기자 중에서 무작위로 뽑습니다. 새로고침하거나 여러 번 신청할
              필요가 없어요. 당첨되면 알려드립니다.
            </p>
          </div>
        </Card>

        <section className="space-y-2">
          <h2 className="font-bold">구역 선택</h2>
          <p className="text-subtle flex items-start gap-1.5 text-xs">
            <Info size={13} className="mt-0.5 shrink-0" />
            매진된 구역에만 대기를 걸 수 있어요. 자리가 남은 구역은 예매로 바로 구매하세요.
          </p>
          {sections && (
            <ResaleSectionList
              sections={sections}
              selectedId={sectionId}
              onSelect={(s) => setSectionId(s.sectionId)}
            />
          )}
        </section>

        {/* 1인 1매 정책이면 고를 게 없어 매수 선택을 통째로 숨깁니다. 정책이 늘어나면 자동으로 다시 보입니다 */}
        {maxPerUser > 1 && (
          <section className="space-y-2">
            <h2 className="font-bold">신청 매수</h2>
            <Segmented options={quantityOptions} value={quantity} onChange={setQuantity} />
            <p className="text-subtle flex items-start gap-1.5 text-xs">
              <Info size={13} className="mt-0.5 shrink-0" />
              2매 이상이면 연석이 아닐 수 있습니다. 매수만 맞으면 배정됩니다.
            </p>
          </section>
        )}

        <BottomBar.Spacer />
      </div>

      <BottomBar className="space-y-2">
        <Button
          variant="dark"
          size="lg"
          fullWidth
          disabled={!sectionId}
          loading={apply.isPending}
          onClick={() =>
            sectionId && apply.mutate({ sectionId, quantity: Number(quantity) })
          }
        >
          대기 신청하기
        </Button>
        <Button variant="ghost" fullWidth onClick={() => navigate(ROUTES.MY_RESALE)}>
          내 대기 목록 보기
        </Button>
      </BottomBar>
    </div>
  );
}
