import { useCallback, useEffect } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { EASE } from '@/shared/lib';

/** 빛이 카드를 한 번 훑는 데 걸리는 시간 */
const SWEEP_SECONDS = 1.05;

/* ── 동작 줄이기용 **정지 광택** ────────────────────────────
   움직임을 지운다고 광택까지 지우면 카드가 인쇄된 종이처럼 죽어 보입니다.
   빛을 사선 한가운데에 **세워두기만** 합니다 (애니메이션 없음).
   🔴 안드로이드는 **절전 모드만 켜도** prefers-reduced-motion 이 reduce 라,
      여기서 아무것도 안 하면 "실제 폰에서만 반짝임이 없는" 상태가 됩니다. */
const STATIC_POSITION = 0.42;
const STATIC_INTENSITY = 0.5;

interface Options {
  /** 처음 한 번 훑기까지의 지연(ms). 화면에 자리를 잡은 뒤여야 "막 도착한 카드" 로 읽힙니다. */
  delayMs?: number;
  /** 이 간격(ms)마다 반복. 안 주면 **한 번만** 훑습니다. */
  repeatMs?: number;
  /** 꺼두기 (닫힌 오버레이 등) */
  enabled?: boolean;
}

/**
 * 포토카드 표면의 **빛 반사** 연출을 굴리는 값들.
 *
 * 화면(`PocaGlare`)은 이 두 값만 보고 그립니다 — 연출 규칙은 여기 한 곳입니다.
 *
 * ⚠️ 목록에는 쓰지 마세요. 카드 12장이 전부 반짝이면 아무것도 특별해 보이지 않고,
 *    무한 루프 반짝임은 전형적인 "AI 가 만든 티" 입니다. (DESIGN.md 8장)
 *    상세 화면의 **한 장**에만, 그리고 반복은 전체화면처럼 카드가 주인공일 때만.
 *
 * ⚠️ `prefers-reduced-motion` 이면 **움직이지 않는 광택**으로 대체합니다
 *    (끄지 않습니다 — DESIGN.md 3장 "동작 줄이기" 참고).
 */
export function useGlareSweep({ delayMs = 260, repeatMs, enabled = true }: Options = {}) {
  const reduced = useReducedMotion() ?? false;

  /** 빛의 가로 위치 (0 = 왼쪽 밖, 1 = 오른쪽 밖) */
  const glare = useMotionValue(0);
  /** 빛의 세기 (0~1) */
  const intensity = useMotionValue(0);

  const sweep = useCallback(() => {
    if (reduced) return;
    glare.set(0);
    intensity.set(0);
    animate(glare, 1, { duration: SWEEP_SECONDS, ease: EASE.out });
    animate(intensity, [0, 1, 1, 0], { duration: SWEEP_SECONDS, times: [0, 0.16, 0.6, 1] });
  }, [glare, intensity, reduced]);

  useEffect(() => {
    if (!enabled) return;

    if (reduced) {
      glare.set(STATIC_POSITION);
      intensity.set(STATIC_INTENSITY);
      return;
    }

    const first = setTimeout(sweep, delayMs);
    if (!repeatMs) return () => clearTimeout(first);

    const timer = setInterval(sweep, repeatMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [sweep, delayMs, repeatMs, enabled, reduced, glare, intensity]);

  return { glare, intensity, sweep };
}
