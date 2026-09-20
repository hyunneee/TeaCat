import { ScanFace, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card } from '@/shared/components/ui';
import { Loading } from '@/shared/components/common';
import { formatDateTime } from '@/shared/lib';
import { seatText } from '../model/operations.model';
import type { OperationsAttendeeDetail } from '../model/operations.types';

interface Props {
  detail: OperationsAttendeeDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  /** 아무 좌석도 고르지 않은 상태 */
  empty: boolean;
  /** 입장 확인 화면으로 이 회차를 들고 이동합니다 */
  onGoCheckIn: () => void;
}

/**
 * 고른 좌석·명단 한 줄의 상세 (순수 View).
 *
 * 🔴 **여기서 검표하지 않습니다.** 카메라와 넓은 좌석맵을 한 화면에 함께 올리지 않기로 했고,
 *    입장 처리는 게이트 검표(입장 확인)의 일입니다. 대신 그 화면으로 **회차를 들고** 가는
 *    버튼을 둡니다 — 운영자가 공연·회차를 다시 고르게 만들지 않기 위해서입니다.
 */
export function OperationsAttendeePanel({ detail, isLoading, isError, empty, onGoCheckIn }: Props) {
  if (empty) {
    return (
      <Card className="text-ink-muted py-12 text-center text-sm">
        좌석이나 명단에서 한 줄을 누르면 예매자 정보가 여기 표시됩니다.
      </Card>
    );
  }

  if (isLoading) return <Loading label="예매자 정보를 불러오는 중" />;

  if (isError || !detail) {
    return (
      <Card className="space-y-2 text-center" role="alert">
        <TriangleAlert size={20} className="text-ink-muted mx-auto" aria-hidden />
        <p className="text-ink text-sm font-semibold">예매자 정보를 불러오지 못했어요</p>
        <p className="text-ink-muted text-xs">
          다른 회차의 티켓이거나 방금 취소됐을 수 있어요. 명단을 새로 불러와 주세요.
        </p>
      </Card>
    );
  }

  const { attendee } = detail;

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-ink-muted text-xs">
          {detail.performanceNum}회차 · {formatDateTime(detail.performanceDate)}
        </p>
        <p className="text-ink text-base font-bold">{seatText(attendee)}</p>
        {detail.grade && <p className="text-ink-muted text-xs">{detail.grade}석</p>}
      </div>

      <dl className="border-line grid grid-cols-[6rem_1fr] gap-y-2 border-t pt-3 text-sm">
        <dt className="text-ink-muted text-xs">예매자</dt>
        <dd className="text-ink">
          {attendee.holderName ?? '—'}
          <span className="text-ink-muted"> · {attendee.holderNickname}</span>
        </dd>

        <dt className="text-ink-muted text-xs">연락처</dt>
        <dd className="text-ink tabular-nums">{attendee.holderPhone ?? '—'}</dd>

        <dt className="text-ink-muted text-xs">티켓 번호</dt>
        <dd className="text-ink tabular-nums">#{attendee.ticketId}</dd>

        <dt className="text-ink-muted text-xs">예매 상태</dt>
        <dd>
          {attendee.status === 'CANCELLED' ? (
            <Badge tone="danger">예매 취소</Badge>
          ) : (
            <Badge tone="neutral">예매 완료</Badge>
          )}
        </dd>

        <dt className="text-ink-muted text-xs">예매 시각</dt>
        <dd className="text-ink-muted text-xs tabular-nums">{formatDateTime(attendee.bookedAt)}</dd>

        <dt className="text-ink-muted text-xs">입장</dt>
        <dd>
          {attendee.checkedInAt ? (
            <span className="text-ink text-sm tabular-nums">
              {formatDateTime(attendee.checkedInAt)}
            </span>
          ) : (
            <span className="text-ink-subtle text-sm">아직 입장하지 않았어요</span>
          )}
        </dd>
      </dl>

      {/* 🔴 개인정보를 담은 화면이라 여기서 할 수 있는 일은 **보는 것**뿐입니다.
          입장 처리가 필요하면 검표 화면으로 보냅니다. */}
      <Button
        variant="soft"
        size="md"
        fullWidth
        leftIcon={<ScanFace size={16} />}
        onClick={onGoCheckIn}
      >
        입장 확인 화면으로
      </Button>
    </Card>
  );
}
