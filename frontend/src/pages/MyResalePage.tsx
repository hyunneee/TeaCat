import { useNavigate } from 'react-router-dom';
import { Dices } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { EmptyState, Loading } from '@/shared/components/common';
import { useModal } from '@/app/providers';
import { ROUTES } from '@/shared/constants';
import { ResaleEntryCard, useCancelResale, useMyResaleEntries } from '@/features/resale';

/**
 * 내 취소표 대기 내역.
 *
 * 추첨은 서버가 돌립니다 — 화면에는 신청을 취소하거나,
 * 당첨된 건을 예매하거나 포기하는 것만 있습니다.
 */
export function MyResalePage() {
  const navigate = useNavigate();
  const { open } = useModal();
  const { data: entries, isPending } = useMyResaleEntries();
  const cancel = useCancelResale();

  return (
    <>
      <Header title="취소표 대기" showBack />

      <div className="p-4">
        {isPending ? (
          <Loading label="대기 내역을 불러오는 중" />
        ) : !entries || entries.length === 0 ? (
          <EmptyState
            icon={Dices}
            title="신청한 대기가 없어요"
            description="원하는 좌석이 없을 때 추첨 대기를 신청해 보세요."
          />
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <ResaleEntryCard
                  entry={entry}
                  onCancel={(id) =>
                    open('common/confirm', {
                      title: '대기 신청을 취소할까요?',
                      message: '다시 신청하면 대기 순서가 처음으로 돌아갑니다.',
                      confirmText: '신청 취소',
                      danger: true,
                      onConfirm: () => cancel.mutate(id),
                    })
                  }
                  onPay={(e) => navigate(ROUTES.BOOKING_SECTION(e.scheduleId))}
                  onForfeit={(e) =>
                    open('common/confirm', {
                      title: '당첨을 포기할까요?',
                      message:
                        '포기하면 이 좌석은 다음 대기자에게 넘어갑니다. 되돌릴 수 없습니다.',
                      confirmText: '포기하기',
                      danger: true,
                      onConfirm: () => cancel.mutate(e.id),
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
