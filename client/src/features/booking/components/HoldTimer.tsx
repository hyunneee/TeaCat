import { motion } from 'motion/react';
import { Timer } from 'lucide-react';
import { cn, formatDuration } from '@/shared/lib';

/**
 * 좌석 선점 잔여 시간.
 *
 * 예매 중 **가장 먼저 봐야 하는 숫자**라 채운 면으로 세웁니다.
 * 평소에는 강조색(진행 중), 1분 미만이면 붉게 + 심장박동처럼 뛰어서
 * "서둘러야 한다"를 몸으로 알립니다.
 */
export function HoldTimer({ remainSeconds }: { remainSeconds: number }) {
  const urgent = remainSeconds > 0 && remainSeconds <= 60;

  return (
    <motion.div
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      animate={urgent ? { scale: [1, 1.07, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 1, repeat: Infinity } : { duration: 0.2 }}
      /* 테두리를 두르지 않습니다 — 헤더 옆의 작은 알약에 선까지 있으면
         시간보다 테두리가 먼저 보입니다. 색 면과 굵은 숫자로 세웁니다. */
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.9375rem] font-extrabold tabular-nums',
        urgent ? 'bg-danger text-white' : 'bg-accent-700 text-white',
      )}
    >
      <Timer size={15} strokeWidth={2.4} />
      {formatDuration(remainSeconds)}
    </motion.div>
  );
}
