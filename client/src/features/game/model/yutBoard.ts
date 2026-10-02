/**
 * 윷판을 화면 좌표로 옮깁니다. 서버의 `YutBoard` 와 밭 번호가 1:1 입니다.
 *
 * 좌표는 0~5 격자입니다 — 바깥이 6×6 정사각형의 테두리이고, 지름길은 그 대각선입니다.
 * 실제 픽셀은 컴포넌트가 정합니다(정사각형이라 한 변만 알면 됩니다).
 *
 * 🔴 번호 배치는 서버가 정답입니다. 여기 숫자를 고치면 말이 엉뚱한 곳에 그려집니다 —
 * 규칙이 바뀌는 것이 아니라 **그림만** 어긋나므로 눈치채기 어렵습니다.
 */

export const YUT_HOME = -1;
export const YUT_CENTER = 21;
export const YUT_GOAL = 28;

export interface YutCell {
  x: number;
  y: number;
  /** 모서리·중앙은 크게 그립니다 */
  big?: boolean;
}

/** 격자 한 변의 칸 수 (0..5) */
export const YUT_GRID = 5;

function outerRing(): YutCell[] {
  return [
    // 오른쪽 변을 위로 — 출발(참먹이)은 오른쪽 아래 모서리입니다
    { x: 5, y: 4 },
    { x: 5, y: 3 },
    { x: 5, y: 2 },
    { x: 5, y: 1 },
    { x: 5, y: 0, big: true }, // 4 · 첫 모서리
    // 윗변을 왼쪽으로
    { x: 4, y: 0 },
    { x: 3, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 0, big: true }, // 9 · 두 번째 모서리
    // 왼쪽 변을 아래로
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 0, y: 3 },
    { x: 0, y: 4 },
    { x: 0, y: 5, big: true }, // 14 · 세 번째 모서리
    // 아랫변을 오른쪽으로
    { x: 1, y: 5 },
    { x: 2, y: 5 },
    { x: 3, y: 5 },
    { x: 4, y: 5 },
  ];
}

/** 밭 번호 → 격자 좌표. 인덱스가 곧 밭 번호입니다 */
export const YUT_CELLS: YutCell[] = [
  ...outerRing(),
  // 지름길 1 — 첫 모서리(5,0)에서 중앙으로
  { x: 4.17, y: 0.83 }, // 19
  { x: 3.33, y: 1.67 }, // 20
  { x: 2.5, y: 2.5, big: true }, // 21 · 중앙
  // 지름길 1의 나머지 — 중앙에서 세 번째 모서리(0,5)로
  { x: 1.67, y: 3.33 }, // 22
  { x: 0.83, y: 4.17 }, // 23
  // 지름길 2 — 두 번째 모서리(0,0)에서 중앙으로
  { x: 0.83, y: 0.83 }, // 24
  { x: 1.67, y: 1.67 }, // 25
  // 지름길 2의 나머지 — 중앙에서 도착(5,5)으로
  { x: 3.33, y: 3.33 }, // 26
  { x: 4.17, y: 4.17 }, // 27
];

/** 도착(참먹이)은 오른쪽 아래 모서리입니다. 출발 자리이기도 합니다 */
export const YUT_GOAL_CELL: YutCell = { x: 5, y: 5, big: true };

export function yutCellOf(position: number): YutCell | null {
  if (position === YUT_HOME) return null;
  if (position === YUT_GOAL) return YUT_GOAL_CELL;
  return YUT_CELLS[position] ?? null;
}

/**
 * 백도 — 지나온 칸으로 한 칸 되돌아갑니다.
 *
 * 칸 수를 그대로 값으로 쓰는 규칙이라 **음수 하나**를 따로 둡니다. 서버 `YutEngine.BACKDO`
 * 와 같은 값이어야 합니다 — 0 을 쓰면 "안 움직임" 과 구분되지 않습니다.
 */
export const YUT_BACKDO = -1;

/** 던지기 결과 이름. 인덱스가 곧 칸 수라 0번은 비어 있습니다 */
export const YUT_THROW_NAMES = ['', '도', '개', '걸', '윷', '모'] as const;

/** 던지기 이름. 백도는 음수라 배열로 찾을 수 없습니다 */
export function yutThrowName(result: number): string {
  return result === YUT_BACKDO ? '백도' : (YUT_THROW_NAMES[result] ?? '');
}

/* ── 길 ───────────────────────────────────────────────────
 *
 * 서버 `YutBoard` 의 경로표를 그대로 옮긴 것입니다. 옮긴 이유는 하나뿐입니다 —
 * **"이 말로 여기 갑니다" 를 판 위에 미리 보여주려고** 요.
 *
 * 🔴 규칙의 정답은 여전히 서버입니다. 여기 계산이 서버와 달라도 말은 서버가 말한
 * 자리로 갑니다. 화면의 미리보기만 틀립니다.
 *
 * 🔴 지름길은 **모서리에 정확히 멈췄을 때만** 탑니다. 그래서 "다음 밭" 함수가 아니라
 * 출발 밭마다 도착까지의 전체 경로로 적습니다 — 중앙(21)에서 갈림길이 생기는데,
 * 지나가는 중이면 22로 이어지고 멈춰 섰으면 26으로 빠지기 때문입니다.
 */

const OUTER_LAST = 18;

/** start 부터 바깥 마지막 밭까지, 그리고 도착 */
function outerFrom(start: number): number[] {
  const route: number[] = [];
  for (let i = start; i <= OUTER_LAST; i++) route.push(i);
  route.push(YUT_GOAL);
  return route;
}

/** ROUTES[from] = from 에서 출발했을 때 지나갈 밭들. 마지막은 항상 도착입니다 */
const ROUTES: number[][] = (() => {
  const routes: number[][] = [];
  for (let i = 0; i <= OUTER_LAST; i++) {
    routes[i] =
      i === 4
        ? [19, 20, YUT_CENTER, 22, 23, ...outerFrom(14)]
        : i === 9
          ? [24, 25, YUT_CENTER, 26, 27, YUT_GOAL]
          : outerFrom(i + 1);
  }
  routes[19] = [20, YUT_CENTER, 22, 23, ...outerFrom(14)];
  routes[20] = [YUT_CENTER, 22, 23, ...outerFrom(14)];
  routes[22] = [23, ...outerFrom(14)];
  routes[23] = outerFrom(14);
  routes[24] = [25, YUT_CENTER, 26, 27, YUT_GOAL];
  routes[25] = [YUT_CENTER, 26, 27, YUT_GOAL];
  routes[26] = [27, YUT_GOAL];
  routes[27] = [YUT_GOAL];
  // 중앙에 멈춰 섰으면 언제나 짧은 쪽으로 나갑니다
  routes[YUT_CENTER] = [26, 27, YUT_GOAL];
  return routes;
})();

/** `from` 에서 `steps` 칸 간 자리. 도착을 지나쳐도 완주입니다 */
export function yutAdvance(from: number, steps: number): number {
  const route = ROUTES[from === YUT_HOME ? 0 : from];
  if (!route) return YUT_GOAL;
  // 판 밖에서 출발하면 첫 밭(0)이 1걸음입니다. ROUTES[0] 은 0 다음부터라 한 칸 당깁니다
  const index = from === YUT_HOME ? steps - 2 : steps - 1;
  if (index < 0) return 0;
  return route[index] ?? YUT_GOAL;
}

/** 자리별 말 색. 자리 번호가 곧 인덱스입니다 */
export const SEAT_COLORS = [
  { chip: 'bg-rose-500', ring: 'ring-rose-300', text: 'text-rose-600' },
  { chip: 'bg-sky-500', ring: 'ring-sky-300', text: 'text-sky-600' },
  { chip: 'bg-amber-500', ring: 'ring-amber-300', text: 'text-amber-600' },
  { chip: 'bg-emerald-500', ring: 'ring-emerald-300', text: 'text-emerald-600' },
] as const;

export function seatColor(seatNo: number) {
  // 인덱스 접근이 undefined 를 낳는 설정이라(noUncheckedIndexedAccess) 첫 색으로 받칩니다
  return SEAT_COLORS[seatNo % SEAT_COLORS.length] ?? SEAT_COLORS[0];
}
