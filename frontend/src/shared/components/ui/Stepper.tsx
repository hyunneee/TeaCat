import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn, SPRING } from '@/shared/lib';

export interface StepperProps {
  steps: readonly string[];
  /** 0-based 현재 단계 */
  current: number;
  className?: string;
}

/**
 * 예매 진행 단계 표시.
 *
 * 티켓팅은 단계가 많아서(인증 → 구역 → 좌석 → 확인 → 결제) 사용자가
 * "지금 어디쯤인지" 모르면 이탈합니다. 상단에 항상 보여줍니다.
 *
 * 레이아웃 주의: 연결선을 라벨과 같은 flex 줄에 두면 좁은 폰에서
 * 선이 공간을 가져가 라벨이 잘립니다("본인인…"). 그래서 각 단계가
 * 균등한 칸 하나를 온전히 쓰고, 연결선은 그 위에 겹쳐 그립니다.
 */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn('flex px-3 py-3', className)}>
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        const isLast = index === steps.length - 1;

        return (
          <li key={label} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
            {/* 연결선 — 이 칸의 원 중심에서 다음 칸의 원 중심까지 */}
            {!isLast && (
              <span
                aria-hidden
                className="bg-line absolute top-[0.6875rem] left-1/2 h-0.5 w-full overflow-hidden"
              >
                <motion.span
                  initial={false}
                  animate={{ scaleX: done ? 1 : 0 }}
                  transition={SPRING}
                  style={{ transformOrigin: 'left' }}
                    className="bg-brand-700 block h-full w-full"
                />
              </span>
            )}

            <motion.span
              aria-current={active ? 'step' : undefined}
              animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.4 }}
              className={cn(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full',
                'text-[0.6875rem] font-bold transition-colors duration-300',
                done && 'bg-brand-700 text-white',
                active && 'bg-brand-900 text-white',
                !done && !active && 'surface-2 text-ink-subtle border-line border',
              )}
            >
              {done ? <Check size={13} strokeWidth={3} /> : index + 1}
            </motion.span>

            <span
              className={cn(
                'w-full text-center text-[0.6875rem] leading-tight font-medium transition-colors duration-300',
                active ? 'text-brand-700' : done ? 'text-ink-muted' : 'text-ink-subtle',
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
