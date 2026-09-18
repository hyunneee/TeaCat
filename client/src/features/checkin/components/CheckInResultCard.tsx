import { CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/shared/components/ui';
import { cn, formatDateTime } from '@/shared/lib';
import type { CheckInResult } from '../model/checkIn.types';

interface Props {
  result: CheckInResult;
}

/**
 * 대조 결과.
 *
 * 🔴 **떨어진 것은 오류가 아닙니다.** "다른 사람" 이라는 답이라, 게이트 직원이 다시 찍게
 * 하거나 다른 방법으로 확인해야 합니다 — 화면이 사고처럼 보이면 안 됩니다.
 *
 * ⚠️ 유사도를 보여주는 건 임계값을 맞춰보는 **지금 단계**뿐입니다. 운영에 굳으면 빼세요 —
 * 점수가 보이면 각도·조명을 바꿔가며 임계값을 넘길 때까지 더듬어 볼 수 있습니다.
 */
export function CheckInResultCard({ result }: Props) {
  const passed = result.match;

  return (
    <Card
      tone={passed ? 'success' : 'danger'}
      className="flex flex-col items-center gap-3 py-8 text-center"
    >
      <span
        className={cn(
          'flex size-14 items-center justify-center rounded-full',
          passed ? 'bg-accent-700 text-white' : 'bg-danger text-white',
        )}
      >
        {passed ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
      </span>

      <div className="space-y-1">
        <p className="text-lg font-extrabold">{passed ? '입장 확인됐어요' : '본인이 아니에요'}</p>
        <p className="text-muted text-sm">
          {passed
            ? `${result.ticket.holderNickname} 님 · ${result.checkedInAt ? formatDateTime(result.checkedInAt) : ''}`
            : '조명이 밝은 곳에서 정면으로 다시 찍어보세요.'}
        </p>
      </div>

      <p className="text-subtle text-xs tabular-nums">
        유사도 {result.similarity.toFixed(4)} / 기준 {result.threshold}
      </p>
    </Card>
  );
}
