import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Hourglass, Info } from 'lucide-react';
import { BottomBar, Header } from '@/shared/components/layout';
import { Button, Card, Segmented } from '@/shared/components/ui';
import { PageLoader } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { env } from '@/shared/config';
import { ResaleSectionList, useApplyResale, useResaleSections } from '@/features/resale';
import { useSchedule } from '@/features/concert';

/**
 * 취소표 추첨 대기 신청.
 *
 * 플로우: 구역 → 취소표 대기 신청 → (서버가 추첨) → 당첨 알림 → 12시간 내 예매
 * 선착순이 아니라 추첨이라 새로고침 경쟁이 의미가 없습니다. 그게 이 기능의 목적입니다.
 */
export function ResalePage() {
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams();

  const [sectionId, setSectionId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');

  const { data: schedule } = useSchedule(scheduleId);
  const { data: sections, isPending } = useResaleSections(scheduleId);
  const apply = useApplyResale(scheduleId);

  const maxPerUser = schedule?.maxPerUser ?? env.maxTicketsPerUser;
  const quantityOptions = Array.from({ length: maxPerUser }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}매`,
  }));

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
          {sections && (
            <ResaleSectionList
              sections={sections}
              selectedId={sectionId}
              onSelect={(s) => setSectionId(s.sectionId)}
            />
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-bold">신청 매수</h2>
          <Segmented options={quantityOptions} value={quantity} onChange={setQuantity} />
          <p className="text-subtle flex items-start gap-1.5 text-xs">
            <Info size={13} className="mt-0.5 shrink-0" />
            2매 이상이면 연석이 아닐 수 있습니다. 매수만 맞으면 배정됩니다.
          </p>
        </section>

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
