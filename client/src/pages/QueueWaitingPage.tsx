import { useNavigate, useParams } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useSchedule } from '@/features/concert';
import { QueueWaitingCard, useLeaveQueue, useQueueWaiting } from '@/features/queue';
import { useModal } from '@/app/providers';

/**
 * 가상 대기실 (플로우차트: 봇 확인 → **대기실** → 구역).
 *
 * 티켓 오픈 때 좌석 페이지 인원을 서버가 정원 이하로 묶습니다. 넘치면 여기서 순번을 보며 기다리고,
 * 서버가 들여보내면(`admitted`) 구역 선택으로 넘어갑니다. 대기실이 꺼진 회차는 곧바로 넘어갑니다.
 *
 * 순번 폴링은 훅이 서버가 알려준 주기로 합니다. 새로고침해도 순번은 유지됩니다 — 서버가 진입 시각으로 줄을 세웁니다.
 */
export function QueueWaitingPage() {
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams();
  const { open } = useModal();
  const { data: schedule } = useSchedule(scheduleId);

  const status = useQueueWaiting(scheduleId, () =>
    navigate(ROUTES.BOOKING_SECTION(scheduleId), { replace: true }),
  );
  const leave = useLeaveQueue();

  /* 대기 취소는 되돌릴 수 없습니다 — 다시 들어오면 줄 맨 뒤입니다 (CLAUDE.md 4-7) */
  const confirmLeave = () =>
    open('common/confirm', {
      title: '대기를 그만둘까요?',
      message: '지금 나가면 순번이 사라지고, 다시 들어오면 줄 맨 뒤에 서게 됩니다.',
      confirmText: '나가기',
      danger: true,
      onConfirm: () =>
        leave.mutate(scheduleId, {
          onSettled: () =>
            navigate(schedule ? ROUTES.CONCERT_DETAIL(String(schedule.concertId)) : ROUTES.HOME, {
              replace: true,
            }),
        }),
    });

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title="대기실" />

      <div className="flex flex-1 flex-col gap-6 p-4 pt-2">
        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold">잠시만 기다려 주세요</h2>
          <p className="text-muted text-sm">
            {schedule?.concertTitle ? `${schedule.concertTitle}에 ` : ''}
            접속한 분이 많아 순서대로 입장하고 있어요. 이 화면을 벗어나지 않아도 차례가 되면
            자동으로 넘어갑니다.
          </p>
        </div>

        {status.isError ? (
          <EmptyState
            title="대기 상태를 불러오지 못했어요"
            description="잠시 후 자동으로 다시 시도합니다."
            action={
              <Button variant="secondary" onClick={() => void status.refetch()}>
                지금 다시 시도
              </Button>
            }
          />
        ) : (
          <QueueWaitingCard
            position={status.data?.position ?? null}
            waitingAhead={status.data?.waitingAhead ?? null}
            estimatedWaitSec={status.data?.estimatedWaitSec ?? null}
          />
        )}

        <ul className="text-subtle space-y-1 text-xs">
          <li>새로고침해도 순번은 유지됩니다.</li>
          <li>입장 후 10분 동안 아무 동작이 없으면 자리가 다음 분에게 넘어갑니다.</li>
        </ul>

        <div className="mt-auto">
          <Button
            variant="danger-ghost"
            size="md"
            fullWidth
            leftIcon={<LogOut size={16} />}
            loading={leave.isPending}
            onClick={confirmLeave}
          >
            대기 그만두기
          </Button>
        </div>
      </div>
    </div>
  );
}
