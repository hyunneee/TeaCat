import { Clock, Hourglass, PartyPopper } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { cn, formatDateTime, formatRemaining } from '@/shared/lib';
import { RESALE_STATUS_LABEL, isPayable, remainToDeadline } from '../model/resale.model';
import type { ResaleEntry } from '../model/resale.types';

interface Props {
  entry: ResaleEntry;
  /** 대기 중일 때 — 신청 취소 */
  onCancel: (entryId: string) => void;
  /** 당첨됐을 때 — 좌석 고르러 가기 */
  onPay: (entry: ResaleEntry) => void;
  /**
   * 당첨됐을 때 — 당첨 포기.
   * 취소와 문구를 나눈 이유: 당첨을 포기하면 그 자리는 다음 사람에게 갑니다.
   * "신청 취소" 와 같은 말로 보이면 무게가 전달되지 않습니다.
   */
  onForfeit: (entry: ResaleEntry) => void;
}

/**
 * 대기 한 건.
 *
 * 추첨은 **서버가** 취소표가 생길 때 돌립니다. 화면에 "추첨 돌려보기" 같은
 * 버튼을 두면 사용자가 직접 돌릴 수 있는 것처럼 보입니다.
 */
export function ResaleEntryCard({ entry, onCancel, onPay, onForfeit }: Props) {
  const payable = isPayable(entry);
  const lost = entry.status === 'LOST' || entry.status === 'EXPIRED';

  /* 목록 항목이라 테두리를 두지 않습니다. 구분은 **면**이 합니다.
     모든 카드가 흰 면 하나로 끝나면 바탕과 붙어 어디가 한 건인지 안 보여서,
     상태를 **머리띠**로 얹어 카드마다 시작점을 만듭니다.
     당첨만 짙은 띠 — 이 화면에서 유일하게 "지금 뭔가 해야 하는" 상태입니다. */
  return (
    <div className={cn('surface shadow-list overflow-hidden rounded-2xl', lost && 'opacity-70')}>
      <div
        className={cn(
          'flex items-center gap-1.5 px-4 py-2 text-[0.8125rem] font-bold',
          payable ? 'bg-brand-900 text-white' : 'surface-2 text-ink-muted',
        )}
      >
        {payable ? (
          <>
            <PartyPopper size={15} className="shrink-0" />
            추첨에 당첨됐어요
          </>
        ) : (
          <>
            <Hourglass size={14} className="shrink-0" />
            {RESALE_STATUS_LABEL[entry.status]}
          </>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-bold">{entry.concertTitle}</p>
          <p className="text-subtle mt-0.5 truncate text-xs">
            {formatDateTime(entry.startAt)} · {entry.sectionName} {entry.quantity}매
          </p>
        </div>

        {payable && (
          <div className="surface-2 text-ink flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold">
            <Clock size={15} className="shrink-0" />
            예매 마감까지 {formatRemaining(remainToDeadline(entry))}
          </div>
        )}

        <div className="flex gap-2">
          {payable && (
            <>
              <Button size="sm" variant="dark" fullWidth onClick={() => onPay(entry)}>
                예매하기
              </Button>
              {/* 되돌릴 수 없는 동작 — 붉게 */}
              <Button size="sm" variant="danger-ghost" onClick={() => onForfeit(entry)}>
                포기하기
              </Button>
            </>
          )}

          {entry.status === 'WAITING' && (
            <Button size="sm" variant="danger-ghost" fullWidth onClick={() => onCancel(entry.id)}>
              신청 취소
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
