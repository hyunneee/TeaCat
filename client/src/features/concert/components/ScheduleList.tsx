import { Hourglass, ScanFace, Ticket } from 'lucide-react';
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
   * 예매를 막아야 하는 이유. 주어지면 **목록 맨 위에 안내를 붙이고** 버튼을 잠급니다.
   * (지금은 얼굴 미등록 — 다른 조건이 생겨도 문구만 바꿔 재사용합니다)
   */
  blocked?: { title: string; description: string; actionLabel: string; onAction: () => void };
}

/**
 * 회차 목록.
 *
 * ── 막힌 이유는 이 컴포넌트가 직접 그립니다 ───────────────
 * 예전에는 목록 위를 덮는 **떠 있는 카드**였습니다. 화면에서 자리를 차지하지 않는
 * `absolute` 요소라, 감싸는 쪽의 여백·높이가 바뀔 때마다 안내가 엉뚱한 곳에 얹혔습니다.
 * 이제 안내는 **목록의 첫 줄**입니다 — 회차가 몇 개든, 바깥이 어떻게 생겼든
 * 언제나 회차 바로 위에 옵니다. 위치를 바깥에서 정할 일이 없습니다.
 *
 * ⚠️ `blocked` 는 **보여주기용 안내일 뿐**입니다.
 *    안내를 개발자도구로 지워도 예매가 되면 안 되므로
 *    버튼 자체를 `disabled` 로 잠그고, 그마저 우회해도
 *    `onBook` 핸들러와 라우트 가드(RequireFace)가 다시 막습니다. (3중 방어)
 *
 * 잔여 좌석 수는 여기 없습니다. 회차 응답에 없고, 좌석 현황은 예매 플로우의
 * 좌석 조회(API-302)가 실시간으로 내려줍니다.
 */
export function ScheduleList({ schedules, onBook, onWaitlist, blocked }: Props) {
  return (
    <div className="space-y-3">
      {blocked && (
        <div className="surface border-line flex items-start gap-3 rounded-2xl border p-3.5">
          <span className="surface-2 text-ink-muted flex size-9 shrink-0 items-center justify-center rounded-full">
            <ScanFace size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{blocked.title}</p>
            <p className="text-muted mt-0.5 text-xs leading-relaxed">{blocked.description}</p>
            {/* 이 화면에서 눌러야 할 것은 이 버튼 하나입니다 —
                아래 예매 버튼은 잠겨 있으므로 강조가 겹치지 않습니다. (DESIGN.md 1장) */}
            <Button size="sm" variant="dark" className="mt-2.5" onClick={blocked.onAction}>
              {blocked.actionLabel}
            </Button>
          </div>
        </div>
      )}

      <Stagger as="ul" className={cn('space-y-2', blocked && 'opacity-60')}>
        {schedules.map((schedule) => {
          const bookable = isBookable(schedule);
          const id = String(schedule.scheduleId);

          return (
            <Stagger.Item as="li" key={schedule.scheduleId}>
              <div className="surface-2 flex items-center gap-3 rounded-2xl p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {formatDateTime(schedule.performanceDate)}
                  </p>
                  <p className="text-subtle mt-0.5 text-xs">{schedule.performanceNum}회차</p>
                </div>

                <Badge tone={scheduleTone(schedule)}>{scheduleStatusLabel(schedule)}</Badge>

                {bookable ? (
                  <Button
                    size="sm"
                    /* 막혀 있을 땐 강조색을 위 안내의 버튼 하나에만 둡니다.
                       초록이 여러 개면 어디를 눌러야 할지 알 수 없습니다. (DESIGN.md 1장) */
                    variant={blocked ? 'secondary' : 'primary'}
                    leftIcon={<Ticket size={14} />}
                    disabled={!!blocked}
                    onClick={() => onBook(id)}
                  >
                    예매
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="soft"
                    leftIcon={<Hourglass size={14} />}
                    disabled={!!blocked}
                    onClick={() => onWaitlist(id)}
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
