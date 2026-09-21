import { useCallback, useRef } from 'react';
import { Stagger } from '@/shared/components/common';
import { useReducedMotion } from '@/shared/hooks';
import type { MemoryCard as Card } from '../model/memoryGame.model';
import { MemoryCard } from './MemoryCard';

interface Props {
  deck: Card[];
  /** 판 번호. 새 판이면 카드가 다시 깔리도록 key 에 섞습니다 (아래 주석) */
  round: number;
  flipped: number[];
  matched: number[];
  missed: boolean;
  /** 판정 대기 중이면 더 받지 않습니다 */
  locked: boolean;
  /**
   * 끝난 판 — 못 찾은 카드까지 전부 열어 보여줍니다.
   * 포기했을 때 "뭐가 어디 있었나" 를 못 보면 다시 할 마음이 들지 않습니다.
   */
  revealAll?: boolean;
  onFlip: (cardId: number) => void;
}

/**
 * 판의 너비 상한 — **스크롤 없이 한 화면에** 들어가게 하는 값.
 *
 * 판은 세로가 더 깁니다(포토카드 2:3 × 4줄). 그래서 화면이 좁으면 너비가,
 * 화면이 낮으면 **높이가** 먼저 걸립니다. `aspect-[2/3]` 만 걸고 `max-height` 로
 * 자르면 높이만 줄어 카드가 납작해지므로, 처음부터 **너비를 높이로 환산해서**
 * 잡습니다 — 그러면 두 방향 모두 비율이 유지됩니다.
 *
 * 빼는 8.5rem 은 판 위아래에 늘 있는 것들입니다(시간 줄 · 여백 · 아래 버튼).
 * 그 구성을 바꾸면 이 값도 함께 보세요. 24rem 은 큰 화면에서 카드가 우스꽝스럽게
 * 커지지 않도록 두는 상한입니다.
 */
const BOARD_MAX_WIDTH =
  'min(24rem, calc((100dvh - var(--spacing-header) - 8.5rem' +
  ' - env(safe-area-inset-top) - env(safe-area-inset-bottom)) * 2 / 3))';

/**
 * 4×4 판.
 *
 * 한 장씩 차례로 깔립니다(`Stagger`) — 16장이 한꺼번에 나타나면 "이미 있던 화면"
 * 처럼 보여서 새 판이 시작된 것이 안 읽힙니다.
 *
 * 🔴 **key 에 `round` 를 섞습니다.** 등장 연출은 마운트할 때만 도는데, 카드 id 는
 * 판이 바뀌어도 0~15 그대로라 key 가 id 뿐이면 React 가 예전 카드를 재사용합니다.
 * 그러면 두 번째 판부터는 카드가 깔리지 않고 그림만 조용히 바뀝니다.
 *
 * 🔴 `onFlip` 은 ref 로 한 번 감쌉니다. 훅의 `flip` 은 매 렌더 새로 만들어지는데,
 * 그대로 내려주면 카드 16장의 `memo` 가 매번 깨져 뒤집는 중에 전부 다시 그려집니다.
 */
export function MemoryBoard({
  deck,
  round,
  flipped,
  matched,
  missed,
  locked,
  revealAll = false,
  onFlip,
}: Props) {
  const reduced = useReducedMotion();

  const latest = useRef(onFlip);
  latest.current = onFlip;
  const stableFlip = useCallback((cardId: number) => latest.current(cardId), []);

  return (
    /* 크기는 바깥 상자가 잡고, 안쪽 격자는 그 상자를 채우기만 합니다.
       (`Stagger` 가 style prop 을 받지 않아서이기도 합니다) */
    <div className="w-full" style={{ maxWidth: BOARD_MAX_WIDTH }}>
      {/* grid-cols-4 · grid-rows-4 는 모델의 GRID_SIZE 와 짝입니다. Tailwind 는 클래스
          이름을 빌드 때 훑기 때문에 `grid-cols-${n}` 처럼 만들어 낸 이름은 CSS 가
          생기지 않습니다. 판 크기를 바꾸면 두 곳을 함께 고치세요. */}
      <Stagger gap={0.035} className="grid aspect-[2/3] w-full grid-cols-4 grid-rows-4 gap-2">
        {deck.map((card) => {
          const isMatched = matched.includes(card.pairId);
          const isFlipped = flipped.includes(card.id);
          return (
            <Stagger.Item key={`${round}-${card.id}`}>
              <MemoryCard
                card={card}
                faceUp={isFlipped || isMatched || revealAll}
                matched={isMatched}
                missed={missed && isFlipped}
                disabled={locked || isFlipped || isMatched}
                reduced={reduced}
                onFlip={stableFlip}
              />
            </Stagger.Item>
          );
        })}
      </Stagger>
    </div>
  );
}
