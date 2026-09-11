import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib';

export interface MarqueeTextProps {
  children: string;
  /** 흐르는 속도 (초당 px). 낮으면 읽을 시간이 생기고, 높으면 휙 지나갑니다 */
  speed?: number;
  className?: string;
}

/** 초당 몇 px 씩 흐를지. 읽으면서 따라갈 수 있는 속도입니다 */
const DEFAULT_SPEED = 55;

/**
 * 한 줄에 안 들어가는 글을 **마우스를 올리면 끝까지 흘려** 보여줍니다.
 *
 * ── 왜 말줄임(…)만으로는 부족한가 ─────────────────────────
 * 목록의 공연명은 뒤쪽이 구분점인 경우가 많습니다 — "티캣 단독 콘서트 2026 : 서울"
 * 처럼요. 말줄임으로 자르면 서울인지 부산인지 알 수 없는데, 카드를 눌러 들어가기
 * 전까지는 확인할 방법이 없습니다.
 *
 * ── 반복(marquee)이 아니라 한 번 밀고 되돌아옵니다 ────────
 * 끝없이 도는 글자는 목록에 여러 개 놓이면 화면이 산만해지고, 읽으려는 순간
 * 처음으로 되감깁니다. 마우스를 올리면 끝까지 밀고 **거기서 멈추고**, 떼면
 * 제자리로 돌아옵니다. 그래서 keyframes 없이 transition 하나로 됩니다.
 *
 * 🔴 **부모에 `group` 이 있어야 동작합니다.** 글자에 마우스를 정확히 올리는 게 아니라
 *    카드 어디에나 올리면 흘러야 하기 때문입니다.
 *
 * 넘치지 않는 글에는 아무 일도 하지 않습니다(움직이지도, 흐려지지도 않습니다).
 * 손가락으로 쓰는 기기에는 hover 가 없어 잘린 채로 보이므로, 넘칠 때만 오른쪽 끝을
 * 흐리게 해서 "뒤에 더 있다" 를 알려줍니다 — 말줄임이 하던 역할입니다.
 */
export function MarqueeText({ children, speed = DEFAULT_SPEED, className }: MarqueeTextProps) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  /** 넘치는 만큼(px). 0 이면 흐를 필요가 없습니다 */
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    /* 글자 폭은 글꼴이 늦게 오면 바뀌고, 칸 폭은 화면을 줄이면 바뀝니다.
       둘 다 지켜보지 않으면 "넘치는데 안 흐르거나" 그 반대가 됩니다. */
    const measure = () => {
      // 1px 은 소수점 반올림 오차입니다. 이걸 안 두면 딱 맞는 글도 흐릅니다
      const overflow = inner.scrollWidth - outer.clientWidth;
      setShift(overflow > 1 ? overflow : 0);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [children]);

  const overflowing = shift > 0;

  return (
    <span
      ref={outerRef}
      className={cn('block overflow-hidden whitespace-nowrap', className)}
      /* 넘칠 때만 오른쪽 끝을 흐리게. 흐르는 동안에는 걷어서 끝 글자가 또렷하게 보입니다 */
      style={
        overflowing
          ? {
              maskImage: 'linear-gradient(to right, #000 82%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, #000 82%, transparent 100%)',
            }
          : undefined
      }
    >
      <span
        ref={innerRef}
        className={cn(
          'inline-block max-w-none transition-transform ease-linear',
          /* 부모 카드에 마우스가 올라가면 넘치는 만큼 왼쪽으로 밀립니다.
             넘치지 않으면 --marquee-shift 를 안 넣으므로 움직이지 않습니다 */
          overflowing && 'group-hover:translate-x-[var(--marquee-shift)]',
          /* 움직임을 줄여달라고 한 사용자에게는 흐르지 않습니다 —
             대신 오른쪽 흐림이 남아 "더 있다" 는 사실은 그대로 전해집니다 */
          'motion-reduce:transition-none motion-reduce:group-hover:translate-x-0',
        )}
        style={
          overflowing
            ? {
                // 흐르는 거리에 비례한 시간이라, 긴 제목도 같은 속도로 지나갑니다
                transitionDuration: `${Math.round((shift / speed) * 1000)}ms`,
                ['--marquee-shift' as string]: `-${shift}px`,
              }
            : undefined
        }
        data-marquee={overflowing ? 'on' : undefined}
      >
        {children}
      </span>
    </span>
  );
}
