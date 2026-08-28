import { useEffect, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn, EASE } from '@/shared/lib';

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
 * ── 왜 진행도를 모듈 스코프에 기억하나 ─────────────────────
 * 단계마다 **라우트가 다르기** 때문에 Stepper 는 페이지를 넘길 때마다
 * 새로 마운트됩니다. 그래서 컴포넌트 상태만으로는 "직전에 어디였는지"를
 * 알 수 없고, 진행 바가 애니메이션 없이 이미 채워진 채로 나타납니다.
 * 마지막 진행도를 모듈에 남겨두고 **거기서부터 이어서** 채웁니다.
 *
 * 순수한 화면 연출 값이라 스토어에 두지 않고 sessionStorage 에 둡니다.
 * 모듈 변수로 두면 개발 중 HMR 마다 초기화되고, 결제 리디렉션으로 돌아왔을 때도
 * 진행도가 0 으로 리셋됩니다.
 *
 * ── 왜 animate prop 이 아니라 명령형인가 ───────────────────
 * 바가 지나간 지점을 `onUpdate` 로 직접 읽기 위해서입니다.
 * 그래야 **원과 라벨이 바가 도착한 그 순간에** 켜집니다.
 * (setTimeout 으로 흉내내면 duration 을 바꿀 때마다 어긋납니다)
 *
 * ⚠️ 백그라운드 탭에서는 requestAnimationFrame 이 멈춰 애니메이션이 진행되지
 *    않습니다. 브라우저 공통 동작이며, 탭으로 돌아오면 이어서 채워집니다.
 *
 * ── 레이아웃 주의 ──────────────────────────────────────────
 * 연결선을 라벨과 같은 flex 줄에 두면 좁은 폰에서 선이 공간을 가져가
 * 라벨이 잘립니다("본인인…"). 각 단계가 균등한 칸을 온전히 쓰고,
 * 진행 바는 그 위에 하나의 트랙으로 겹쳐 그립니다.
 */
const STORE_KEY = 'tikat.stepper';

function readProgress(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(`${STORE_KEY}:${key}`);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    // 프라이빗 모드 등에서 sessionStorage 가 막힐 수 있습니다. 연출일 뿐이라 무시합니다.
    return null;
  }
}

function writeProgress(key: string, value: number): void {
  try {
    sessionStorage.setItem(`${STORE_KEY}:${key}`, String(value));
  } catch {
    /* 무시 */
  }
}

/** 원의 세로 중심 (ol 의 py-3 + 원 반지름 − 선 두께 절반) */
const TRACK_TOP = 'calc(0.75rem + 0.6875rem)';
const SLIDE_SECONDS = 0.6;

export function Stepper({ steps, current, className }: StepperProps) {
  const reduced = useReducedMotion() ?? false;
  const count = steps.length;
  const trackKey = steps.join('|');
  const last = count - 1;
  const progress = count > 1 ? Math.min(Math.max(current, 0), last) / last : 1;

  // 마운트 시점에 한 번만 읽습니다 — 이 값이 애니메이션의 출발점입니다.
  const [from] = useState(() => (reduced ? progress : (readProgress(trackKey) ?? 0)));

  const fill = useMotionValue(from);
  /** 바가 지나간 마지막 단계. 원·라벨은 이 값을 따라 켜집니다. */
  const [passedStep, setPassedStep] = useState(() => Math.round(from * last));

  useEffect(() => {
    writeProgress(trackKey, progress);

    if (reduced || count < 2) {
      fill.set(progress);
      setPassedStep(Math.round(progress * last));
      return;
    }

    const controls = animate(fill, progress, {
      duration: SLIDE_SECONDS,
      ease: EASE.out,
      // 경계를 넘을 때만 상태가 바뀝니다 — 매 프레임 리렌더하지 않습니다.
      onUpdate: (value) => setPassedStep(Math.floor(value * last + 1e-6)),
    });
    return () => controls.stop();
  }, [progress, reduced, count, last, trackKey, fill]);

  return (
    <ol className={cn('relative flex px-3 py-3', className)}>
      {/* 진행 트랙 — 첫 원의 중심에서 마지막 원의 중심까지 하나로 잇습니다 */}
      {count > 1 && (
        <div
          aria-hidden
          className="bg-line absolute h-0.5 overflow-hidden rounded-full"
          style={{
            top: TRACK_TOP,
            left: `calc(0.75rem + (100% - 1.5rem) / ${count * 2})`,
            width: `calc((100% - 1.5rem) * ${last} / ${count})`,
          }}
        >
          <motion.span
            className="bg-brand-800 block h-full w-full origin-left"
            style={{ scaleX: fill }}
          />
        </div>
      )}

      {steps.map((label, index) => {
        // 바가 아직 도착하지 않은 단계는 "다음 단계"처럼 그립니다.
        const arrived = index <= passedStep;
        const done = index < current && arrived;
        const activeNow = index === current && arrived;

        return (
          <li key={label} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <motion.span
              aria-current={index === current ? 'step' : undefined}
              initial={false}
              animate={activeNow ? { scale: [1, 1.16, 1] } : { scale: 1 }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
              className={cn(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full',
                'text-[0.6875rem] font-bold transition-colors duration-300',
                done && 'bg-brand-800 text-white',
                activeNow && 'bg-brand-900 text-white',
                !done && !activeNow && 'surface-2 text-ink-subtle border-line border',
              )}
            >
              {done ? <Check size={13} strokeWidth={3} /> : index + 1}
            </motion.span>

            <span
              className={cn(
                'w-full text-center text-[0.6875rem] leading-tight transition-colors duration-300',
                activeNow
                  ? 'text-brand-900 font-semibold'
                  : done
                    ? 'text-ink-muted font-medium'
                    : 'text-ink-subtle font-medium',
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
