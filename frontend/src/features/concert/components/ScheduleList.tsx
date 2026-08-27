import { Dices, Ticket } from 'lucide-react';
import { Badge, Button } from '@/shared/components/ui';
import { Stagger } from '@/shared/components/common';
import { formatDateTime } from '@/shared/lib';
import { isBookable, scheduleStatusLabel, scheduleTone } from '../model/schedule.model';
import type { ScheduleSummary } from '../model/concert.types';

interface Props {
  schedules: ScheduleSummary[];
  onBook: (scheduleId: string) => void;
  /** 취소표 추첨 대기 신청 (매진이거나 오픈 전일 때) */
  onWaitlist: (scheduleId: string) => void;
}

export function ScheduleList({ schedules, onBook, onWaitlist }: Props) {
  return (
    <Stagger as="ul" className="space-y-2">
      {schedules.map((schedule) => {
        const bookable = isBookable(schedule);

        return (
          <Stagger.Item as="li" key={schedule.id}>
            <div className="surface edge-light border-line flex items-center gap-3 rounded-xl border p-3.5">
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
                <Button size="sm" leftIcon={<Ticket size={14} />} onClick={() => onBook(schedule.id)}>
                  예매
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="soft"
                  leftIcon={<Dices size={14} />}
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
  );
}
