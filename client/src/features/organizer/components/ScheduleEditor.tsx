import { useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { Badge, Button, IconButton, Input } from '@/shared/components/ui';
import { formatDateTime } from '@/shared/lib';
import { scheduleStatusLabel, scheduleTone, type ScheduleSummary } from '@/features/concert';

interface Props {
  schedules: ScheduleSummary[];
  /** 새 회차 일시(`datetime-local`)를 검사해 에러 문구를 돌려줍니다. 없으면 통과 */
  validate: (date: string) => string | undefined;
  onAdd: (date: string) => void;
  onRemove: (scheduleId: string) => void;
  adding: boolean;
  /** 삭제 진행 중인 회차 ID — 그 줄의 버튼만 잠급니다 */
  removingId: string | null;
}

/**
 * 수정 화면의 회차 목록 편집 (순수 View — 목록·검사 함수·핸들러를 props 로 받습니다).
 *
 * 기존 회차는 한 줄에 일시·번호·상태와 삭제 버튼. 삭제는 되돌릴 수 없어 붉은 아이콘이고,
 * 실제 확인 모달은 페이지가 띄웁니다 (모달은 화면 조립의 일이라 View 가 열지 않습니다).
 *
 * 추가는 아래 입력 한 줄로 합니다. 등록 화면처럼 여러 줄을 쌓지 않는 이유는
 * 여기서는 한 번에 하나씩 서버에 바로 반영되기 때문입니다.
 */
export function ScheduleEditor({ schedules, validate, onAdd, onRemove, adding, removingId }: Props) {
  const [date, setDate] = useState('');
  const [touched, setTouched] = useState(false);

  const error = validate(date);

  const submit = () => {
    setTouched(true);
    if (error) return;
    onAdd(date);
    setDate('');
    setTouched(false);
  };

  return (
    <div className="space-y-3">
      {schedules.length === 0 ? (
        <p className="text-subtle py-3 text-center text-sm">아직 등록된 회차가 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {schedules.map((schedule) => {
            const id = String(schedule.scheduleId);
            return (
              <li key={schedule.scheduleId} className="surface-2 flex items-center gap-3 rounded-2xl p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{formatDateTime(schedule.performanceDate)}</p>
                  <p className="text-subtle mt-0.5 text-xs">{schedule.performanceNum}회차</p>
                </div>
                <Badge tone={scheduleTone(schedule)}>{scheduleStatusLabel(schedule)}</Badge>
                <IconButton
                  label={`${schedule.performanceNum}회차 삭제`}
                  variant="danger-ghost"
                  size="sm"
                  disabled={removingId === id}
                  onClick={() => onRemove(id)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      {/* 추가 — 입력과 버튼을 한 줄에. 추가하면 서버가 이 공연의 회차 번호를 일시(날짜+시간) 순으로 다시 매깁니다 */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            type="datetime-local"
            aria-label="추가할 회차 공연 일시"
            value={date}
            error={touched ? (error ?? null) : null}
            hint="티켓팅 오픈 이후 일시. 추가하면 회차 번호가 일시 순으로 다시 매겨져요."
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </div>
        <Button
          type="button"
          variant="soft"
          size="md"
          className="mt-0.5"
          leftIcon={<CalendarPlus size={16} />}
          loading={adding}
          disabled={touched && !!error}
          onClick={submit}
        >
          추가
        </Button>
      </div>
    </div>
  );
}
