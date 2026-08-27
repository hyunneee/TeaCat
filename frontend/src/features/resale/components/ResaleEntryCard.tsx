import { Dices, Clock } from 'lucide-react';
import { Badge, Button, Card } from '@/shared/components/ui';
import { formatDateTime, formatDuration } from '@/shared/lib';
import { RESALE_STATUS_LABEL, isPayable, remainToDeadline, resaleTone } from '../model/resale.model';
import type { ResaleEntry } from '../model/resale.types';

interface Props {
  entry: ResaleEntry;
  onCancel: (entryId: string) => void;
  onPay: (entry: ResaleEntry) => void;
  /** 데모용 즉시 추첨 */
  onDraw?: (entryId: string) => void;
  drawing?: boolean;
}

export function ResaleEntryCard({ entry, onCancel, onPay, onDraw, drawing }: Props) {
  const payable = isPayable(entry);
  const lost = entry.status === 'LOST' || entry.status === 'EXPIRED';

  return (
    <Card tone={payable ? 'success' : lost ? 'default' : 'default'} className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{entry.concertTitle}</p>
          <p className="text-subtle mt-0.5 truncate text-xs">
            {formatDateTime(entry.startAt)} · {entry.sectionName} {entry.quantity}매
          </p>
        </div>
        <Badge tone={resaleTone(entry.status)}>
          {RESALE_STATUS_LABEL[entry.status]}
        </Badge>
      </div>

      {payable && (
        <div className="bg-success-soft text-success border-success/30 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold">
          <Clock size={13} />
          결제 마감까지 {formatDuration(remainToDeadline(entry))}
        </div>
      )}

      <div className="flex gap-2">
        {payable && (
          <Button size="sm" fullWidth onClick={() => onPay(entry)}>
            결제하기
          </Button>
        )}

        {entry.status === 'WAITING' && (
          <>
            {onDraw && (
              <Button
                size="sm"
                variant="soft"
                fullWidth
                loading={drawing}
                leftIcon={<Dices size={15} />}
                onClick={() => onDraw(entry.id)}
              >
                추첨 돌려보기
              </Button>
            )}
            {/* 되돌릴 수 없는 동작 — 붉게 */}
            <Button size="sm" variant="danger-ghost" onClick={() => onCancel(entry.id)}>
              신청 취소
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
