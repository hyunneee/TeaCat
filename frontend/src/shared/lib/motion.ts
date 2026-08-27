import type { Transition, Variants } from 'motion/react';

/**
 * 앱 전체가 공유하는 모션 상수.
 *
 * 화면마다 duration/easing 을 새로 적으면 "이 화면만 느리다/튄다" 는 인상이 생깁니다.
 * 여기 있는 것만 골라 쓰세요. 새 패턴이 필요하면 여기에 추가합니다. (DESIGN.md)
 */

/* ── 지속시간 (ms 아님, 초 단위 — motion 규격) ──────────────
   티켓팅 화면(좌석·결제)에서는 QUICK 이상 쓰지 마세요. 속도가 곧 UX 입니다. */
export const DURATION = {
  quick: 0.14,
  base: 0.24,
  slow: 0.36,
} as const;

export const EASE = {
  /* 자연스러운 감속 — 대부분 여기 */
  out: [0.22, 1, 0.36, 1],
  /* 살짝 튕기며 자리잡음 — 선택/성공 피드백 */
  back: [0.34, 1.56, 0.64, 1],
} as const;

/** 물리적으로 붙는 느낌. 위치/크기 이동에 씁니다. */
export const SPRING: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 };
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 260, damping: 26 };

/* ── 재사용 variants ─────────────────────────────────────── */

/** 아래에서 살짝 올라오며 등장 — 카드·섹션 기본값 */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.out } },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.quick, ease: EASE.out } },
};

/** 팝업/뱃지처럼 "톡" 나타나는 요소 */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE.back } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: DURATION.quick } },
};

/**
 * 목록 컨테이너 — 자식이 순차적으로 등장합니다.
 * 항목이 많으면 마지막 항목이 늦게 뜨므로 stagger 를 짧게 유지하세요.
 */
export const staggerParent = (stagger = 0.045): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: 0.02 } },
});

/** staggerParent 안에 넣는 자식 */
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.out } },
};

/* ── 페이지 전환 ─────────────────────────────────────────
   좌우 슬라이드는 "앞으로 감/뒤로 감" 느낌을 주지만 라우터에서 방향을 알아야 합니다.
   방향 판단 없이도 자연스럽도록 아주 짧은 페이드+미세 이동만 씁니다. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.out } },
  exit: { opacity: 0, y: -6, transition: { duration: DURATION.quick, ease: EASE.out } },
};

/** 바텀시트 */
export const sheetTransition: Variants = {
  hidden: { y: '100%' },
  show: { y: 0, transition: SPRING },
  exit: { y: '100%', transition: { duration: DURATION.base, ease: EASE.out } },
};

/** 가운데 다이얼로그 */
export const dialogTransition: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.back } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: DURATION.quick } },
};

/**
 * "동작 줄이기" 가 켜진 사용자를 위해 이동을 없애고 페이드만 남깁니다.
 * useReducedMotion() 결과를 넘기세요.
 */
export function reduceIfNeeded(variants: Variants, reduced: boolean): Variants {
  if (!reduced) return variants;
  return {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: DURATION.quick } },
    exit: { opacity: 0, transition: { duration: DURATION.quick } },
  };
}
