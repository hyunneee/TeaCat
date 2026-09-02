import { motion } from 'motion/react';
import { cn, SPRING } from '@/shared/lib';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** 라벨 옆 개수 표시 */
  count?: number;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** 트랙 안쪽 여백(p-1 = 0.25rem × 좌우). 알약 폭 계산에 그대로 씁니다. */
const TRACK_PADDING = '0.5rem';

/**
 * 탭/필터. 제네릭이라 값 타입이 문자열 유니온으로 좁혀집니다.
 *
 *   <Segmented options={TABS} value={tab} onChange={setTab} />
 *
 * onChange 인자가 'ALL' | 'VALID' | 'USED' 로 추론되므로 오타가 컴파일 에러가 됩니다.
 *
 * ── 선택 알약은 **비율로** 움직입니다 (측정하지 않습니다) ──
 * 예전에는 `layoutId` 공유 레이아웃으로 알약을 옮겼습니다. 그런데 layout 애니메이션은
 * **뷰포트 기준으로 위치를 재서** 전후 차이를 되돌리는 방식이라,
 * 이 컴포넌트처럼 `sticky` 영역 안에 있으면서 그 사이 스크롤이 움직인 경우
 * 잰 값이 어긋나 알약이 **화면 밖(아래)에서 날아 들어옵니다.**
 * (포카 마켓에서 스크롤을 내린 뒤 구매/판매를 누를 때 나던 증상)
 *
 * 칸은 모두 같은 폭(flex-1)이므로 알약의 자리는 **인덱스 × 100%** 로 정확히 나옵니다.
 * 재는 과정이 없으니 스크롤·sticky·페이지 전환과 무관하게 늘 제자리입니다.
 * (그래서 칸 사이 `gap` 도 두지 않습니다 — 간격이 있으면 이 계산이 어긋납니다)
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      role="tablist"
      className={cn(
        'surface-sunken border-line relative flex rounded-xl border p-1',
        className,
      )}
    >
      {/* 알약 하나가 자리를 옮겨 다닙니다 (칸마다 하나씩 만들지 않습니다) */}
      <motion.span
        aria-hidden
        className="surface-strong absolute top-1 bottom-1 left-1 rounded-lg"
        style={{ width: `calc((100% - ${TRACK_PADDING}) / ${options.length})` }}
        /* initial={false} — 처음 그릴 때는 애니메이션 없이 제자리에서 시작합니다.
           안 그러면 화면에 들어올 때마다 알약이 왼쪽 끝에서 미끄러져 옵니다. */
        initial={false}
        animate={{ x: `${index * 100}%` }}
        transition={SPRING}
      />

      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              /* 알약 위에 글자가 오도록 z-10. 알약은 뒤에 깔립니다. */
              'relative z-10 flex-1 rounded-xl px-3 py-2 text-sm font-semibold',
              'transition-colors duration-150',
              active ? 'text-white' : 'text-ink-subtle hover:text-ink-muted',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="ml-1 text-xs opacity-70">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
