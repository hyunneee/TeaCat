import { useNavigate } from 'react-router-dom';
import { Hourglass } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { TicketNavigation } from '@/shared/components/layout/TicketNavigation';
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
      <Header title="내 티켓" />
      <TicketNavigation />

      <div className="p-4">
        {isPending ? (
          <Loading label="대기 내역을 불러오는 중" />
        ) : !entries || entries.length === 0 ? (
          <EmptyState
            icon={Hourglass}
            title="신청한 대기가 없어요"
            description="원하는 좌석이 없을 때 추첨 대기를 신청해 보세요."
          />
        ) : (
          <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {entries.map((entry) => (
              <li key={entry.id}>
                <ResaleEntryCard
                  entry={entry}
                  onCancel={(id) =>
                    open('common/confirm', {
                      title: '대기 신청을 취소할까요?',
                      message: '취소하면 이 구역 추첨에 더 이상 참여하지 않습니다. 언제든 다시 신청할 수 있어요.',
                      confirmText: '신청 취소',
                      danger: true,
                      onConfirm: () => cancel.mutate({ entryId: id, mode: 'cancel' }),
                    })
                  }
                  /* 당첨 좌석은 서버가 이미 내 선점(HELD, 결제 기한까지)으로 잡아 두었다.
                     구역·좌석을 다시 고르게 하면 그 자리가 남의 것처럼 보인다 — 예매 확인으로 바로 간다.
                     확인 화면은 서버 선점을 되살린다(useResumeHold) */
                  onPay={(e) => navigate(ROUTES.BOOKING_REVIEW(e.scheduleId))}
                  /* 포기는 두 번 묻습니다. 첫 번째는 되돌릴 수 없는 포기 자체, 두 번째는 그 뒤 대기를
                     이어갈지입니다. 한 모달에 세 버튼을 두면 어느 것이 위험한지 읽히지 않습니다.
                     두 번째 모달에서 닫기(ESC·바깥)도 "대기 끝내기" 로 봅니다 — 포기는 이미 확정했고,
                     대기를 다시 걸고 싶으면 구역 화면에서 언제든 신청할 수 있습니다 */
                  onForfeit={(e) =>
                    open('common/confirm', {
                      title: '당첨을 포기할까요?',
                      message:
                        '포기하면 이 좌석은 남은 대기자끼리 곧바로 다시 추첨됩니다. 되돌릴 수 없습니다.',
                      confirmText: '포기하기',
                      danger: true,
                      onConfirm: () =>
                        open('common/confirm', {
                          title: '다시 대기를 시작할까요?',
                          message:
                            '다시 대기하면 다음 취소표부터 추첨에 참여합니다. 방금 포기한 좌석의 재추첨에는 들어가지 않아요.',
                          confirmText: '다시 대기하기',
                          cancelText: '대기 끝내기',
                          onConfirm: () => cancel.mutate({ entryId: e.id, mode: 'forfeit-rejoin' }),
                          onCancel: () => cancel.mutate({ entryId: e.id, mode: 'forfeit' }),
                        }),
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
