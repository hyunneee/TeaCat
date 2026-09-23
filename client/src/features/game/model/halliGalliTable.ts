import { Banana, Cherry, Citrus, Grape, type LucideIcon } from 'lucide-react';
import type { HalliGalliCard } from './game.types';

/**
 * 과일 → 그림과 이름.
 *
 * 🔴 이모지를 박지 않습니다 (client/CLAUDE.md 3-5). 서버의 과일 이름이 체리·포도인 것도
 * 여기 그림이 있기 때문입니다 — lucide 에 딸기·자두가 없어서, 이름을 맞추지 않으면
 * "딸기라는데 체리가 그려진" 카드가 됩니다.
 */
interface Fruit {
  icon: LucideIcon;
  label: string;
  /** 선 색 */
  tone: string;
  /**
   * 속을 채우는 색.
   *
   * 🔴 선 색보다 **한 단계 연하게** 잡습니다. 같은 색으로 채우면 lucide 아이콘의 안쪽
   * 선(체리의 줄기, 포도알의 경계)이 면에 묻혀 덩어리 하나로 보입니다. 그러면 정작
   * 세어야 하는 **개수**가 안 보입니다.
   */
  fill: string;
}

export const FRUITS: Record<HalliGalliCard['fruit'], Fruit> = {
  CHERRY: { icon: Cherry, label: '체리', tone: 'text-rose-600', fill: 'fill-rose-300' },
  BANANA: { icon: Banana, label: '바나나', tone: 'text-amber-600', fill: 'fill-amber-200' },
  LIME: { icon: Citrus, label: '라임', tone: 'text-lime-700', fill: 'fill-lime-300' },
  GRAPE: { icon: Grape, label: '포도', tone: 'text-violet-600', fill: 'fill-violet-300' },
};

/**
 * 자리 방향. **나는 언제나 남(아래)** 이고, 나머지는 차례 순서대로 시계방향으로 앉습니다.
 *
 * 시계방향은 화면에서 남 → 서 → 북 → 동 입니다 (시계의 6시에서 9시, 12시, 3시).
 * 내 다음 차례인 사람이 내 오른쪽이 아니라 **왼쪽(서)** 에 앉는 이유가 이것입니다.
 */
export type Compass = 'S' | 'W' | 'N' | 'E';

/**
 * 인원수별 자리. 앞에서부터 "나 → 다음 차례 → 그다음…" 순서입니다.
 *
 * 둘이 할 때 서(왼쪽)가 아니라 북(맞은편)에 앉히는 이유는, 마주 보고 하는 판이
 * 한쪽으로 쏠린 판보다 읽기 쉽기 때문입니다. 셋부터는 시계방향 그대로입니다.
 */
const SEATING: Record<number, Compass[]> = {
  1: ['S'],
  2: ['S', 'N'],
  3: ['S', 'W', 'N'],
  4: ['S', 'W', 'N', 'E'],
};

/**
 * 자리 번호 → 화면 방향.
 *
 * @param seatNo   그릴 사람의 자리 번호
 * @param mySeatNo 나의 자리 번호 (없으면 0번을 남에 둡니다 — 관전 화면용)
 * @param players  판에 앉은 사람 수
 */
export function compassOf(seatNo: number, mySeatNo: number, players: number): Compass {
  const seating = SEATING[players] ?? SEATING[4]!;
  /* 나를 0으로 놓고 차례 순서대로 몇 번째인지. 자리 번호가 곧 차례 순서입니다 */
  const offset = (seatNo - mySeatNo + players) % players;
  return seating[offset] ?? 'S';
}

/** 방향 → 격자 위치. 가운데(종 자리)를 비워 둡니다 */
export const COMPASS_CELL: Record<Compass, string> = {
  N: 'col-start-2 row-start-1',
  W: 'col-start-1 row-start-2',
  E: 'col-start-3 row-start-2',
  S: 'col-start-2 row-start-3',
};
