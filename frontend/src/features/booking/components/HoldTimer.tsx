import { motion } from 'motion/react';
import { Timer } from 'lucide-react';
import { cn, formatDuration } from '@/shared/lib';

/**
 * 좌석 선점 잔여 시간.
 * 1분 미만이면 붉게 + 심장박동처럼 뛰어서 "서둘러야 한다"를 몸으로 알립니다.
 */
export function HoldTimer({ remainSeconds }: { remainSeconds: number }) {
  const urgent = remainSeconds > 0 && remainSeconds <= 60;

  return (
    <motion.div
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      animate={urgent ? { scale: [1, 1.07, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 1, repeat: Infinity } : { duration: 0.2 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold tabular-nums',
        urgent
          ? 'bg-danger border-danger text-white'
          : 'surface-2 border-line text-ink-muted',
      )}
    >
      <Timer size={14} />
      {formatDuration(remainSeconds)}
    </motion.div>
  );
}
