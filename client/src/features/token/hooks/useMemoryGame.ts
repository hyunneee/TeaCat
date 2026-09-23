import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createDeck,
  PAIR_COUNT,
  rewardFor,
  type DeckArt,
  type MemoryCard,
  type MemoryStatus,
} from '../model/memoryGame.model';

/** 짝이 아닐 때 다시 엎기까지. 짧으면 못 보고, 길면 답답합니다 */
const MISS_HOLD_MS = 760;

export interface MemoryGame {
  deck: MemoryCard[];
  /** 판 번호. 새 판에서 카드가 다시 깔리도록 화면이 key 에 섞습니다 */
  round: number;
  status: MemoryStatus;
  /** 지금 뒤집혀 있고 아직 판정 나지 않은 카드 id (0~2장) */
  flipped: number[];
  /** 짝을 맞춰 계속 열려 있는 pairId */
  matched: number[];
  /** 방금 뒤집은 두 장이 빗나갔는가 — 흔들림 연출용 */
  missed: boolean;
  moves: number;
  /** 맞춘 쌍 수 */
  pairsFound: number;
  /** 시작 시각(ms). 타이머는 이 값으로 화면이 직접 셉니다 (아래 주석) */
  startedAt: number | null;
  /** 끝난 판의 소요 시간. 진행 중에는 null */
  elapsedMs: number | null;
  /** 클리어 시 받게 될 캣머니 — 🔴 아직 지급되지 않습니다 */
  reward: number | null;
  /**
   * 클리어 알림(모달)이 떠 있는가.
   *
   * `status === 'cleared'` 로 바로 띄우지 않습니다 — 그러면 닫아도 다시 뜹니다.
   * 닫은 뒤에는 다 열린 판을 그대로 볼 수 있어야 합니다.
   */
  resultOpen: boolean;
  dismissResult: () => void;
  start: () => void;
  flip: (cardId: number) => void;
  giveUp: () => void;
}

/**
 * 포토카드 뒤집기 한 판.
 *
 * ── 🔴 진행 시간을 여기서 세지 않는 이유 ──────────────────────
 * 흘러가는 초를 이 훅의 state 로 두면 **1초마다 판 전체(16장)가 다시 그려집니다.**
 * 카드마다 3D 회전이 걸려 있어서, 그 리렌더가 애니메이션 중간에 끼면 프레임이 튑니다.
 * 그래서 훅은 **시작 시각만** 내주고, 실제로 초를 세는 건 그 숫자를 보여주는
 * 컴포넌트 하나(`MemoryHud`)입니다. 다시 그려지는 것은 글자 한 줄뿐입니다.
 */
export function useMemoryGame(art: DeckArt[] = []): MemoryGame {
  const [deck, setDeck] = useState<MemoryCard[]>(() => createDeck(art));
  const [round, setRound] = useState(0);
  const [status, setStatus] = useState<MemoryStatus>('idle');
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [missed, setMissed] = useState(false);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  /* 빗나간 두 장을 다시 엎는 타이머. 포기·재시작·언마운트에서 반드시 끊어야
     이미 사라진 판의 카드를 뒤늦게 엎는 일이 없습니다. */
  /* 새 판을 깔 때의 그림. ref 로 들고 있어야 `start` 가 렌더마다 새로 만들어지지 않습니다
     (art 는 후보 목록에서 매번 다시 고르므로 참조가 계속 바뀝니다) */
  const artRef = useRef(art);
  artRef.current = art;

  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearMissTimer = useCallback(() => {
    if (missTimer.current) clearTimeout(missTimer.current);
    missTimer.current = null;
  }, []);
  useEffect(() => clearMissTimer, [clearMissTimer]);

  const start = useCallback(() => {
    clearMissTimer();
    setDeck(createDeck(artRef.current));
    setRound((n) => n + 1);
    setFlipped([]);
    setMatched([]);
    setMissed(false);
    setMoves(0);
    setElapsedMs(null);
    setResultOpen(false);
    /* 🔴 여기서 시계를 켜지 않습니다. **첫 카드를 뒤집을 때** 시작합니다 —
       판이 깔리고 그림을 훑어보는 시간까지 기록에 들어가면, 화면을 켜 두고 자리를
       비운 사람이 불리해집니다. 시작 시각은 `flip` 이 정합니다. */
    setStartedAt(null);
    setStatus('playing');
  }, [clearMissTimer]);

  const dismissResult = useCallback(() => setResultOpen(false), []);

  const giveUp = useCallback(() => {
    clearMissTimer();
    setFlipped([]);
    setMissed(false);
    setStatus('gaveup');
    setElapsedMs(startedAt === null ? 0 : Date.now() - startedAt);
  }, [clearMissTimer, startedAt]);

  const flip = useCallback(
    (cardId: number) => {
      if (status !== 'playing') return;
      // 판정 대기 중(두 장이 떠 있음)에는 더 받지 않습니다. 세 장이 열리면 규칙이 무너집니다.
      if (flipped.length >= 2) return;
      if (flipped.includes(cardId)) return;

      const card = deck.find((c) => c.id === cardId);
      if (!card || matched.includes(card.pairId)) return;

      /* 🔴 **여기가 시계가 켜지는 자리입니다.** 위 가드를 전부 지난 뒤여야 합니다 —
         이미 맞춘 카드를 눌러도 시작되면 누르지도 않은 시간이 기록에 들어갑니다.
         같은 호출 안에서 setState 한 값은 아직 읽을 수 없으므로, 아래 계산은 전부
         이 지역 변수(`began`)를 씁니다. */
      const began = startedAt ?? Date.now();
      if (startedAt === null) setStartedAt(began);

      const next = [...flipped, cardId];
      setFlipped(next);
      if (next.length < 2) return;

      setMoves((n) => n + 1);

      const [firstId] = next;
      const first = deck.find((c) => c.id === firstId);
      if (first && first.pairId === card.pairId) {
        /* 맞았으면 기다릴 이유가 없습니다 — 바로 열어 둔 상태로 넘깁니다.
           🔴 다음 matched 를 setter 밖에서 만듭니다. updater 안에서 setStatus 를 부르면
              StrictMode 에서 updater 가 두 번 돌며 클리어가 두 번 잡힙니다. */
        const found = [...matched, card.pairId];
        setMatched(found);
        setFlipped([]);
        if (found.length === PAIR_COUNT) {
          setStatus('cleared');
          setElapsedMs(Date.now() - began);
          setResultOpen(true);
        }
        return;
      }

      setMissed(true);
      missTimer.current = setTimeout(() => {
        setFlipped([]);
        setMissed(false);
        missTimer.current = null;
      }, MISS_HOLD_MS);
    },
    [deck, flipped, matched, startedAt, status],
  );

  return {
    deck,
    round,
    status,
    flipped,
    matched,
    missed,
    moves,
    pairsFound: matched.length,
    startedAt,
    elapsedMs,
    reward: status === 'cleared' && elapsedMs !== null ? rewardFor(elapsedMs) : null,
    resultOpen,
    dismissResult,
    start,
    flip,
    giveUp,
  };
}
