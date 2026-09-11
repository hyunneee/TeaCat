import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { CatMascot, type CatMood } from '@/shared/components/ui';
import { cn } from '@/shared/lib';

interface Props {
  /** 아이콘을 주면 아이콘, 안 주면 마스코트가 나옵니다. */
  icon?: LucideIcon;
  /** 마스코트 표정 (icon 을 안 넘겼을 때만) */
  mood?: CatMood;
  title: string;
  description?: string;
  action?: ReactNode;
  /** 남은 높이를 다 쓰게 하려면 `flex-1` 을 넘기세요 (세로 flex 화면에서) */
  className?: string;
}

/** 아무리 좁아도 이만큼은 차지합니다 (자기 위에 내용이 많은 자리에 놓였을 때) */
const MIN_HEIGHT = 240;

/**
 * 이 요소 **아래에** 남아 있는 높이 — 뒤따르는 형제들과 조상들의 아래 여백.
 *
 * 남은 높이를 채울 때 이만큼을 빼지 않으면 그 몫만큼 화면이 길어져,
 * 가만히 있는 화면인데 몇 px 씩 스크롤됩니다(폰에서는 튕김으로 보입니다).
 *
 * 🔴 자리를 차지하지 않는 형제(`fixed`·`absolute`)는 셈에서 뺍니다 —
 *    하단 탭이 대표적이고, 그 자리는 이미 본문의 `pb-nav` 가 잡아 뒀습니다.
 *    두 번 빼면 안내가 그만큼 위로 올라갑니다.
 */
function spaceBelow(el: HTMLElement): number {
  let total = 0;
  let node: HTMLElement | null = el;

  /* 레이아웃 껍데기(`app-frame`)까지만 올라갑니다. 그 위는 화면 전체라 뺄 것이 없습니다 */
  while (node && !node.classList.contains('app-frame')) {
    for (let sibling = node.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
      const position = getComputedStyle(sibling).position;
      if (position === 'fixed' || position === 'absolute') continue;
      total += sibling.getBoundingClientRect().height;
    }

    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    total += parseFloat(getComputedStyle(parent).paddingBottom) || 0;
    node = parent;
  }

  return total;
}

/**
 * "예매 내역이 없어요" 같은 빈 목록 표시. 화면마다 새로 만들지 마세요.
 *
 * **화면 세로 가운데**에 놓입니다. 목록 자리 맨 위에 붙어 있으면
 * "여기까지만 불러온 건가?" 로 읽혀서 사용자가 스크롤을 계속합니다.
 *
 * ── 가운데를 어떻게 잡나 ───────────────────────────────────
 * 예전에는 `min-h-[48dvh]` 고정이었습니다. 그러면 **이 상자 안에서만** 가운데라,
 * 위에 머리말·검색창·세그먼트가 쌓인 화면일수록 안내가 위로 쏠립니다
 * (데스크톱 상단 내비는 109px 이라 눈에 띄게 어긋났습니다).
 *
 * 그래서 자기 위에 무엇이 얼마나 있는지 **직접 재서** 남은 높이를 채웁니다.
 * 부모가 flex 든 아니든 상관없이 동작하는 것이 중요합니다 — 이 컴포넌트를 쓰는
 * 화면이 스무 곳이 넘고, 그 전부를 세로 flex 로 바꾸는 건 위험이 더 큽니다.
 *
 * 재는 값은 **문서 기준 위치**(rect.top + scrollY)입니다. 화면 기준으로 재면
 * 스크롤된 상태에서 창 크기가 바뀔 때 엉뚱한 높이가 나옵니다.
 * 아래쪽은 `spaceBelow` 가 형제·조상 여백까지 훑습니다 (주석 참고).
 */
export function EmptyState({
  icon: Icon,
  mood = 'sad',
  title,
  description,
  action,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [fill, setFill] = useState<number | null>(null);

  /* 그리기 **전에** 재야 안내가 한 번 위에 떴다가 내려오는 게 안 보입니다 */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const offset = el.getBoundingClientRect().top + window.scrollY;
      const next = Math.max(MIN_HEIGHT, Math.round(window.innerHeight - offset - spaceBelow(el)));
      setFill((prev) => (prev === next ? prev : next));
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      style={fill ? { minHeight: fill } : undefined}
      className={cn(
        'flex min-h-[48dvh] flex-col items-center justify-center gap-4 px-6 py-10 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="surface-2 border-line text-ink-subtle flex size-16 items-center justify-center rounded-xl border">
          <Icon size={28} strokeWidth={1.5} />
        </span>
      ) : (
        <CatMascot mood={mood} size={84} />
      )}

      <div className="space-y-1">
        <p className="font-bold">{title}</p>
        {description && <p className="text-muted text-sm">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  );
}
