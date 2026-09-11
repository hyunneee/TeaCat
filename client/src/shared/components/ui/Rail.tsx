import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAutoScroll } from '@/shared/hooks';
import { cn } from '@/shared/lib';

export interface RailProps {
  /** 가로로 늘어설 트랙 (보통 `<ul className="flex w-max …">`) */
  children: ReactNode;
  /** 스스로 흐를지. 항목이 둘 이상일 때만 켜세요 */
  autoScroll?: boolean;
  /** 흐르는 속도 (초당 px). 레일이 둘 이상이면 **서로 다르게** 두세요 */
  speed?: number;
  /** 스크롤 영역에 붙일 클래스 (예: `-mx-4` 로 화면 끝까지 흘리기) */
  className?: string;
  /** 화살표 라벨 앞에 붙습니다. 한 화면에 레일이 여럿이면 구분됩니다 */
  label?: string;
}

/**
 * 화살표를 어느 높이에 둘지 알려주는 표시.
 *
 * 카드 안에서 **그림 부분**에 이 속성을 붙이세요 — 화살표가 그 세로 한가운데에
 * 앉습니다. 안 붙이면 레일 전체의 한가운데라, 그림 밑에 제목·부제가 있는 카드에서는
 * 화살표가 글자 쪽으로 처집니다.
 *
 *   <div data-rail-anchor>     <PosterImage … />     </div>
 */
export const RAIL_ANCHOR = { 'data-rail-anchor': '' } as const;

/** 한 번에 넘길 폭 — 칸 폭이 제각각일 수 있어 **보이는 폭의 비율**로 셉니다.
 *  1.0 으로 두면 방금 보던 마지막 카드가 사라져 "어디까지 봤더라" 가 됩니다. */
const PAGE_RATIO = 0.8;

/**
 * 가로 레일 — 옆으로 미는 목록. (홈의 "진행 중인 티켓팅" 등)
 *
 * 세로로 쌓지 않는 이유: 두 장만 보여도 화면이 다 차서 아래 내용이 밀려납니다.
 *
 * ── 넘기는 방법이 화면마다 다릅니다 ────────────────────────
 *   폰        손가락으로 밉니다. 화살표는 **두지 않습니다** — 좁은 화면에서
 *             버튼 두 개가 카드를 가리고, 어차피 미는 게 더 빠릅니다.
 *   데스크톱  좌우 화살표. 마우스로는 가로 스크롤이 어렵습니다.
 *
 * 🔴 화살표는 **넘길 게 있을 때만** 나옵니다. 항목이 적어 한 화면에 다 들어가면
 *    누를 수 없는 버튼이 되어, 눌러 본 사람은 고장으로 읽습니다.
 *
 * ⚠️ 자동 흐름(`autoScroll`)과 화살표는 같은 스크롤을 건드립니다. 화살표는
 *    목록 **밖**에 있어서 훅이 알아채지 못하므로 `hold()` 로 직접 멈춥니다 —
 *    안 그러면 눌러서 넘긴 자리를 자동 흐름이 곧바로 되돌립니다.
 */
export function Rail({ children, autoScroll = false, speed = 14, className, label }: RailProps) {
  const { ref, hold } = useAutoScroll<HTMLDivElement>({ enabled: autoScroll, speed });
  const [scrollable, setScrollable] = useState(false);
  /** 화살표가 앉을 높이(px). 기준 요소가 없으면 null → 레일 한가운데 */
  const [arrowTop, setArrowTop] = useState<number | null>(null);

  /* 넘길 것이 있는지 · 화살표를 어느 높이에 둘지. 항목이 늘거나 창이 좁아지면
     둘 다 답이 바뀌므로 계속 지켜봅니다.
     자동 흐름이 매 프레임 스크롤을 건드리니 **값이 달라질 때만** 상태를 바꿉니다 —
     안 그러면 초당 60번 리렌더합니다. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const next = el.scrollWidth - el.clientWidth > 1;
      setScrollable((prev) => (prev === next ? prev : next));

      /* 기준 요소(`data-rail-anchor`)의 세로 한가운데로. 없으면 레일 한가운데입니다.
         레일 전체를 기준으로 삼으면 카드 밑의 제목·부제까지 높이에 들어가서
         화살표가 그림 아래로 처집니다 — 눈은 **그림**을 보고 있습니다. */
      const anchor = el.querySelector<HTMLElement>('[data-rail-anchor]');
      if (!anchor) {
        setArrowTop(null);
        return;
      }
      const a = anchor.getBoundingClientRect();
      const top = Math.round(a.top - el.getBoundingClientRect().top + a.height / 2);
      setArrowTop((prev) => (prev === top ? prev : top));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    /* 자식(카드)이 늦게 들어오면 트랙 폭과 그림 높이가 그때 정해집니다 */
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [ref, children]);

  const page = useCallback(
    (direction: 1 | -1) => {
      const el = ref.current;
      if (!el) return;
      hold();
      el.scrollBy({
        left: direction * Math.round(el.clientWidth * PAGE_RATIO),
        behavior: 'smooth',
      });
    },
    [ref, hold],
  );

  return (
    <div className="relative">
      <div ref={ref} className={cn('overflow-x-auto', className)}>
        {children}
      </div>

      {scrollable && (
        <>
          <RailArrow side="left" top={arrowTop} label={label} onClick={() => page(-1)} />
          <RailArrow side="right" top={arrowTop} label={label} onClick={() => page(1)} />
        </>
      )}
    </div>
  );
}

function RailArrow({
  side,
  top,
  label,
  onClick,
}: {
  side: 'left' | 'right';
  /** 앉을 높이(px). null 이면 레일 한가운데 */
  top: number | null;
  label?: string;
  onClick: () => void;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      aria-label={`${label ? `${label} ` : ''}${side === 'left' ? '이전' : '다음'}`}
      onClick={onClick}
      style={{ top: top ?? '50%' }}
      className={cn(
        /* 배너 화살표와 달리 **밝은 바탕 위**라 어두운 원을 쓸 수 없습니다.
           흰 면 + 테두리 + 그림자로 띄웁니다. */
        'bg-surface-1 border-line text-ink shadow-card hidden size-9 items-center justify-center',
        'absolute -translate-y-1/2 rounded-full border transition-colors lg:flex',
        'hover:bg-surface-2',
        /* 카드 모서리에 반쯤 걸칩니다. 완전히 밖에 두면 본문 폭을 벗어나 내비·본문
           왼쪽 끝선이 어긋나 보이고, 완전히 안에 두면 포스터를 덮습니다. */
        side === 'left' ? '-left-4' : '-right-4',
      )}
    >
      <Icon size={18} />
    </button>
  );
}
