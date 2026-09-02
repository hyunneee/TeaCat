import { useEffect, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

interface Options {
  /** 흐르는 속도 (초당 px). 20 이하로 두세요 — 빠르면 읽는 걸 방해합니다. */
  speed?: number;
  /** 항목이 하나뿐이면 굴리지 않습니다 */
  enabled?: boolean;
}

/** 손을 뗀 뒤 다시 흐르기까지 */
const RESUME_MS = 2500;

/**
 * 가로 목록이 **끊김 없이 흐르게** 합니다. (홈의 가로 레일)
 *
 * ── 왜 한 칸씩 넘기지 않나 ─────────────────────────────────
 * 몇 초마다 한 칸씩 이동시키면 멈춰 있다가 툭 튀는 게 반복돼 눈에 거슬립니다.
 * 매 프레임 아주 조금씩 밀어 **물 흐르듯** 움직이게 합니다.
 *
 * ── 끝에서 되감지 않고 방향을 바꿉니다 ────────────────────
 * 끝에 닿았을 때 처음으로 되돌리면 그 순간이 튑니다.
 * 왔다 갔다 하면 튀는 지점이 아예 없습니다. 항목이 몇 개 안 되는
 * 레일에는 이쪽이 훨씬 자연스럽습니다.
 *
 * ── 손을 대면 멈춥니다 ────────────────────────────────────
 * 읽는 중에 화면이 움직이면 짜증납니다. 떼고 잠시 뒤 다시 흐릅니다.
 *
 * ⚠️ 이 훅을 쓰는 목록에는 `snap-mandatory` 를 걸지 마세요.
 *    스냅이 매 프레임 위치를 되돌려 서로 싸웁니다.
 * ⚠️ `prefers-reduced-motion` 이면 전혀 움직이지 않습니다.
 */
export function useAutoScroll<T extends HTMLElement>({ speed = 14, enabled = true }: Options = {}) {
  const ref = useRef<T>(null);
  const pausedUntil = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || reduced) return;

    const hold = () => {
      pausedUntil.current = Date.now() + RESUME_MS;
    };
    el.addEventListener('pointerdown', hold);
    el.addEventListener('wheel', hold, { passive: true });
    el.addEventListener('touchmove', hold, { passive: true });

    let raf = 0;
    let last = 0;
    let direction: 1 | -1 = 1;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      // 탭이 뒤로 갔다 돌아오면 dt 가 커집니다. 한 번에 튀지 않게 잘라냅니다.
      const dt = last === 0 ? 0 : Math.min(now - last, 50);
      last = now;
      if (dt === 0 || Date.now() < pausedUntil.current) return;

      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) return;

      let next = el.scrollLeft + direction * speed * (dt / 1000);
      if (next >= max) {
        next = max;
        direction = -1;
      } else if (next <= 0) {
        next = 0;
        direction = 1;
      }
      el.scrollLeft = next;
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', hold);
      el.removeEventListener('wheel', hold);
      el.removeEventListener('touchmove', hold);
    };
  }, [speed, enabled, reduced]);

  return ref;
}
