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

/**
 * 움직임 없이 **페이드만** 하는 자식 (`<Stagger fade>`).
 *
 * 🔴 **글자만 있는 블록에 씁니다.** 위 `staggerChild` 는 `y: 10 → 0` 인데, 이 값이
 * 0 에 닿는 순간 motion 이 인라인 스타일에 `transform: none` 을 써넣습니다
 * (motion-dom 의 `buildTransform`: 값이 전부 기본값이면 "none"). 그러면 그 요소에
 * 잡혀 있던 합성 레이어가 사라지면서 **글자가 다시 래스터화**됩니다 — 합성 레이어의
 * 회색조 안티에일리어싱에서 서브픽셀 안티에일리어싱으로 바뀌고 정수 픽셀에 다시 맞물리는데,
 * 그 한 프레임이 <b>"다 올라오고 나서 한 번 끊김"</b> 으로 보입니다 (QA).
 *
 * transform 을 아예 쓰지 않으면 만들 레이어도, 없앨 레이어도 없어서 끊김이 사라집니다.
 *
 * ⚠️ 카드·이미지가 섞인 목록에는 `staggerChild` 를 그대로 두세요 — 거기서는 글자
 * 재래스터화가 눈에 띄지 않고, 올라오는 움직임이 "읽는 순서" 를 만들어 줍니다.
 */
export const staggerChildFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE.out } },
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
