import { useNavigate } from 'react-router-dom';
import { Dices } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { SkeletonList } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { env } from '@/shared/config';
import {
  ResaleEntryCard,
  useCancelResale,
  useDrawResale,
  useMyResaleEntries,
} from '@/features/resale';

export function MyResalePage() {
  const navigate = useNavigate();
  const { data: entries, isPending } = useMyResaleEntries();
  const cancel = useCancelResale();
  const draw = useDrawResale();

  return (
    <>
      <Header title="취소표 대기" showBack />

      <div className="p-4">
        {isPending ? (
          <SkeletonList count={2} />
        ) : !entries || entries.length === 0 ? (
          <EmptyState
            icon={Dices}
            title="신청한 대기가 없어요"
            description="원하는 좌석이 없을 때 추첨 대기를 신청해 보세요."
          />
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <ResaleEntryCard
                  entry={entry}
                  onCancel={(id) => cancel.mutate(id)}
                  onPay={(e) => navigate(ROUTES.BOOKING_SECTION(e.scheduleId))}
                  // 데모용 즉시 추첨 — 실제로는 서버가 취소표 발생 시 돌립니다.
                  onDraw={env.useMock ? (id) => draw.mutate(id) : undefined}
                  drawing={draw.isPending}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
