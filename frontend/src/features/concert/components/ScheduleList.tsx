import { Dices, ScanFace, Ticket } from 'lucide-react';
import { Badge, Button } from '@/shared/components/ui';
import { Stagger } from '@/shared/components/common';
import { cn, formatDateTime } from '@/shared/lib';
import { isBookable, scheduleStatusLabel, scheduleTone } from '../model/schedule.model';
import type { ScheduleSummary } from '../model/concert.types';

interface Props {
  schedules: ScheduleSummary[];
  onBook: (scheduleId: string) => void;
  /** 취소표 추첨 대기 신청 (매진이거나 오픈 전일 때) */
  onWaitlist: (scheduleId: string) => void;
  /**
   * 예매를 막아야 하는 이유. 주어지면 목록 위를 덮고 버튼도 잠급니다.
   * (지금은 얼굴 미등록 — 다른 조건이 생겨도 문구만 바꿔 재사용합니다)
   */
  blocked?: { title: string; description: string; actionLabel: string; onAction: () => void };
}

/**
 * 회차 목록.
 *
 * ⚠️ `blocked` 는 **보여주기용 안내일 뿐**입니다.
 *    덮개를 개발자도구로 지워도 예매가 되면 안 되므로
 *    버튼 자체를 `disabled` 로 잠그고, 그마저 우회해도
 *    `onBook` 핸들러와 라우트 가드(RequireFace)가 다시 막습니다. (3중 방어)
 */
export function ScheduleList({ schedules, onBook, onWaitlist, blocked }: Props) {
  return (
    <div className="relative">
      {blocked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-3">
          {/* 목록이 흐릿하게 비쳐서 "가려져 있다"는 게 읽히게 합니다 */}
          <div aria-hidden className="surface/80 absolute inset-0 rounded-2xl backdrop-blur-[3px]" />
          <div className="border-line surface shadow-card relative w-full rounded-2xl border p-4 text-center">
            <span className="surface-2 border-line text-ink-muted mx-auto mb-2.5 flex size-10 items-center justify-center rounded-full border">
              <ScanFace size={19} />
            </span>
            <p className="text-sm font-bold">{blocked.title}</p>
            <p className="text-muted mt-1 text-xs leading-relaxed">{blocked.description}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={blocked.onAction}>
              {blocked.actionLabel}
            </Button>
          </div>
        </div>
      )}

      <Stagger as="ul" className={cn('space-y-2', blocked && 'pointer-events-none select-none')}>
      {schedules.map((schedule) => {
        const bookable = isBookable(schedule);

        return (
          <Stagger.Item as="li" key={schedule.id}>
            <div className="surface-2 flex items-center gap-3 rounded-2xl p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{formatDateTime(schedule.startAt)}</p>
                <p className="text-subtle mt-0.5 text-xs">
                  잔여 {schedule.availableSeats.toLocaleString()}석 · 1인 {schedule.maxPerUser}매
                </p>
              </div>

              <Badge tone={scheduleTone(schedule)}>
                {scheduleStatusLabel(schedule)}
              </Badge>

              {bookable ? (
                <Button
                  size="sm"
                  /* 덮개가 떠 있을 땐 강조색을 덮개의 버튼 하나에만 둡니다.
                     초록이 여러 개면 어디를 눌러야 할지 알 수 없습니다. (DESIGN.md 1장) */
                  variant={blocked ? 'secondary' : 'primary'}
                  leftIcon={<Ticket size={14} />}
                  disabled={!!blocked}
                  onClick={() => onBook(schedule.id)}
                >
                  예매
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="soft"
                  leftIcon={<Dices size={14} />}
                  disabled={!!blocked}
                  onClick={() => onWaitlist(schedule.id)}
                >
                  대기
                </Button>
              )}
            </div>
          </Stagger.Item>
        );
      })}
      </Stagger>
    </div>
  );
}
