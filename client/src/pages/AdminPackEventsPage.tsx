import { useState } from 'react';
import { Plus, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { formatDateTime } from '@/shared/lib';
import { useModal } from '@/app/providers';
import {
  AdminPackEventFormModal,
  ongoingEvent,
  packEventState,
  useAdminPackEvents,
  useCreatePackEvent,
  useSetPackEventActive,
  type AdminPackEvent,
  type PackEventState,
} from '@/features/admin';

/** 왜 지금 안 나가는지까지 말해 줍니다 — '꺼짐' 하나로는 기간 문제를 못 찾습니다 */
const STATE: Record<PackEventState, { label: string; tone: 'accent-solid' | 'neutral' | 'info' }> =
  {
    ongoing: { label: '지급 중', tone: 'accent-solid' },
    off: { label: '닫힘', tone: 'neutral' },
    before: { label: '시작 전', tone: 'info' },
    ended: { label: '종료됨', tone: 'info' },
  };

const period = (event: AdminPackEvent) =>
  `${event.startsAt ? formatDateTime(event.startsAt) : '즉시'} ~ ${
    event.endsAt ? formatDateTime(event.endsAt) : '무기한'
  }`;

/**
 * 카드팩 이벤트 관리 — 처음 주는 카드팩을 여닫는 화면입니다.
 *
 * 🔴 **진행 중인 이벤트가 하나도 없으면 카드팩이 지급되지 않습니다.** 서버는 이걸 에러가 아니라
 * "줄 게 없다" 로 넘기기 때문에, 아무 말 없이 팩만 안 생깁니다. 그래서 맨 위에 지금 지급되는
 * 이벤트를 먼저 적습니다.
 *
 * 페이지는 조립만 합니다 (CLAUDE.md 3-6). 접근 제어는 라우터의 `RequireRole(['ADMIN'])`.
 */
export function AdminPackEventsPage() {
  const { data: events, isPending } = useAdminPackEvents();
  const create = useCreatePackEvent();
  const setActive = useSetPackEventActive();
  const { open } = useModal();

  const [adding, setAdding] = useState(false);
  const live = events ? ongoingEvent(events) : undefined;

  /* 닫는 건 되돌릴 수 있지만 그동안 아무도 못 받습니다 — 한 번 묻습니다 */
  const askToClose = (event: AdminPackEvent) =>
    open('common/confirm', {
      title: `'${event.name}' 을 닫을까요?`,
      message:
        '지금부터 카드팩이 지급되지 않습니다. 이미 받은 팩은 회수되지 않고, 다시 열 수 있습니다.',
      confirmText: '닫기',
      onConfirm: () => setActive.mutate({ eventId: event.id, active: false }),
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-lg font-bold">카드팩 이벤트</h1>
          <p className="text-ink-muted text-sm">
            열어 두면 뽑기 화면에 들어오는 것만으로 카드팩이 하나 생깁니다. 사용자가 입력할 코드는
            없고, 한 사람은 <b>구분 코드당 한 번만</b> 받습니다.
          </p>
        </div>
        <Button variant="dark" leftIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
          이벤트 열기
        </Button>
      </div>

      {/* 🔴 "왜 팩이 안 생기지" 의 답이 거의 항상 여기입니다 */}
      {!isPending &&
        (live ? (
          <Card className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
            <Badge tone="accent-solid" size="sm">
              지급 중
            </Badge>
            <span className="text-ink font-semibold">{live.name}</span>
            <span className="text-ink-muted text-sm">{period(live)}</span>
          </Card>
        ) : (
          <Card className="flex items-start gap-2 p-4">
            <TriangleAlert size={18} className="text-danger mt-0.5 shrink-0" />
            <p className="text-sm">
              <b className="text-danger">지금 지급되는 이벤트가 없습니다.</b>{' '}
              <span className="text-ink-muted">
                뽑기 화면에 들어가도 카드팩이 생기지 않습니다. 이벤트를 열거나, 닫힌 이벤트를 다시
                켜세요.
              </span>
            </p>
          </Card>
        ))}

      {isPending ? (
        <Skeleton className="h-40" />
      ) : !events || events.length === 0 ? (
        <EmptyState
          title="아직 이벤트가 없어요"
          description="이벤트를 열어야 처음 들어온 사람에게 카드팩이 지급됩니다."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event) => {
            const state = STATE[packEventState(event)];

            return (
              <li key={event.id}>
                <Card className="flex items-center gap-4 p-4">
                  <Badge tone={state.tone} size="sm">
                    {state.label}
                  </Badge>

                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate font-semibold">{event.name}</p>
                    <p className="text-ink-muted truncate text-sm">
                      {event.code} · {period(event)}
                    </p>
                  </div>

                  <p className="text-ink-muted shrink-0 text-sm tabular-nums">
                    {event.grantedCount.toLocaleString()}개 지급
                  </p>

                  {/* 스위치만 바꿉니다 — 코드·기간은 서버가 수정을 받지 않습니다 */}
                  {event.active ? (
                    <Button variant="soft" size="sm" onClick={() => askToClose(event)}>
                      닫기
                    </Button>
                  ) : (
                    <Button
                      variant="dark"
                      size="sm"
                      loading={setActive.isPending}
                      onClick={() => setActive.mutate({ eventId: event.id, active: true })}
                    >
                      열기
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AdminPackEventFormModal
        open={adding}
        onClose={() => setAdding(false)}
        isPending={create.isPending}
        onSubmit={(body) => create.mutate(body, { onSuccess: () => setAdding(false) })}
      />
    </div>
  );
}
