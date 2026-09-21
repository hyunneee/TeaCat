import { useCallback, useEffect, useRef, useState } from 'react';
import {
  spawnPiece,
  stageSpec,
  STAGE_COUNT,
  STAGE_MS,
  type FailReason,
  type Piece,
  type SongpyeonStatus,
} from '../model/songpyeonGame.model';

/**
 * 판을 다시 보는 간격.
 *
 * 사라질 때가 된 조각을 치우고, 나올 때가 되면 새로 만듭니다. 🔴 **이 간격마다 화면이 다시
 * 그려지지는 않습니다** — 조각이 늘거나 줄 때만 state 를 바꿉니다. 그냥 매번 새 배열을
 * 넣으면 초당 12번씩 판 전체가 다시 그려집니다.
 *
 * 남은 시간을 세는 것은 여기가 아니라 그 숫자를 보여주는 컴포넌트(`SongpyeonHud`)입니다
 * (`useMemoryGame` 과 같은 이유).
 */
const TICK_MS = 80;

interface Options {
  /** 5단계를 통과한 순간 한 번 불립니다 — 보상 청구가 여기 붙습니다 */
  onClear?: () => void;
}

export interface SongpyeonGame {
  status: SongpyeonStatus;
  /** 지금 도전 중인 단계 (1 ~ STAGE_COUNT) */
  stage: number;
  /** 지금 판에 떠 있는 것들 */
  pieces: Piece[];
  /** 이번 단계가 시작된 시각(ms). 남은 시간은 화면이 이 값으로 셉니다 */
  stageStartedAt: number | null;
  /** 왜 끝났는가. 진행 중이거나 통과했으면 null */
  failReason: FailReason | null;
  /**
   * 통과 알림(모달)이 떠 있는가.
   *
   * `status === 'cleared'` 로 바로 띄우지 않습니다 — 그러면 닫아도 다시 뜹니다.
   * 오늘 몫이 끝난 뒤에는 `start` 가 아무 일도 하지 않으므로, 닫는 길을 따로 둬야
   * 모달에 갇히지 않습니다. (`useMemoryGame` 과 같은 이유)
   */
  resultOpen: boolean;
  dismissResult: () => void;
  start: () => void;
  catchPiece: (pieceId: number) => void;
}

/**
 * 송편 잡기 한 판.
 *
 * 송편을 잡으면 다음 단계, 다른 것을 잡거나 10초를 넘기면 끝입니다. 끝나면 **1단계부터**
 * 다시 합니다 — 이어하기는 없습니다(`songpyeonGame.model` 주석).
 *
 * 🔴 **끝나도 판을 지우지 않습니다.** 방해물을 눌러 끝난 순간 판이 비면 자기가 무엇을
 * 눌렀는지 못 봅니다. 시계만 멈추고 조각은 그대로 둡니다.
 */
export function useSongpyeonGame({ onClear }: Options = {}): SongpyeonGame {
  const [status, setStatus] = useState<SongpyeonStatus>('idle');
  const [stage, setStage] = useState(1);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [stageStartedAt, setStageStartedAt] = useState<number | null>(null);
  const [failReason, setFailReason] = useState<FailReason | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  /* 렌더마다 새로 만들어지는 콜백이라 ref 로 들고 있습니다 — 안 그러면 `start` 가
     매번 새 함수가 되고, 그걸 의존성으로 쓰는 쪽이 계속 다시 붙습니다 */
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;

  /* 🔴 판정에 쓰는 값은 전부 ref 입니다. 0.08초마다 도는 루프가 state 를 읽으면 그 순간의
     낡은 값(클로저)을 보게 되고, "방금 사라진 조각을 눌렀는데 통과" 같은 일이 납니다. */
  const piecesRef = useRef<Piece[]>([]);
  const stageRef = useRef(1);
  const stageStartRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const lastSongpyeonRef = useRef(0);
  const nextIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyPieces = useCallback((next: Piece[]) => {
    piecesRef.current = next;
    setPieces(next);
  }, []);

  const stopClock = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  // 화면을 떠나면 반드시 멈춥니다 — 사라진 판의 타이머가 계속 돌면 안 됩니다
  useEffect(() => stopClock, [stopClock]);

  const fail = useCallback(
    (reason: FailReason) => {
      stopClock();
      setFailReason(reason);
      setStatus('failed');
      setStageStartedAt(null);
    },
    [stopClock],
  );

  const clear = useCallback(() => {
    /* 판은 지우지 않습니다 — 마지막에 무엇이 떠 있었는지 보이는 편이 낫습니다(실패와 같은 규칙) */
    stopClock();
    setStatus('cleared');
    setStageStartedAt(null);
    setResultOpen(true);
    onClearRef.current?.();
  }, [stopClock]);

  const dismissResult = useCallback(() => setResultOpen(false), []);

  const beginStage = useCallback(
    (next: number) => {
      const now = Date.now();
      stageRef.current = next;
      stageStartRef.current = now;
      /* 단계가 바뀌자마자 조각이 튀어나오면 "언제 시작했는지" 를 놓칩니다.
         한 박자(spawnMs) 쉬었다가 첫 조각이 나오게 시작 시각을 그대로 넣습니다 */
      lastSpawnRef.current = now;
      lastSongpyeonRef.current = now;
      setStage(next);
      setStageStartedAt(now);
      applyPieces([]);
    },
    [applyPieces],
  );

  const tick = useCallback(() => {
    const now = Date.now();

    if (now - stageStartRef.current >= STAGE_MS) {
      fail('timeout');
      return;
    }

    const spec = stageSpec(stageRef.current);
    const alive = piecesRef.current.filter((piece) => piece.diesAt > now);

    let born: Piece | null = null;
    if (now - lastSpawnRef.current >= spec.spawnMs) {
      born = spawnPiece({
        now,
        lastSongpyeonAt: lastSongpyeonRef.current,
        lifetimeMs: spec.lifetimeMs,
        nextId: nextIdRef.current,
        taken: alive,
      });
      nextIdRef.current += 1;
      lastSpawnRef.current = now;
      if (born.kind === 'songpyeon') lastSongpyeonRef.current = now;
    }

    // 달라진 게 없으면 state 를 건드리지 않습니다 (위 TICK_MS 주석)
    if (!born && alive.length === piecesRef.current.length) return;
    applyPieces(born ? [...alive, born] : alive);
  }, [applyPieces, fail]);

  /* 인터벌은 한 번만 걸고, 안에서 **그때그때 최신 tick** 을 부릅니다.
     tick 을 직접 걸면 의존성이 바뀔 때마다 인터벌을 다시 만들어야 합니다 */
  const tickRef = useRef(tick);
  tickRef.current = tick;

  const start = useCallback(() => {
    stopClock();
    setFailReason(null);
    setResultOpen(false);
    setStatus('playing');
    beginStage(1);
    timerRef.current = setInterval(() => tickRef.current(), TICK_MS);
  }, [beginStage, stopClock]);

  const catchPiece = useCallback(
    (pieceId: number) => {
      if (status !== 'playing') return;

      const piece = piecesRef.current.find((item) => item.id === pieceId);
      /* 사라지는 중인 조각은 없는 것으로 봅니다. 눌린 순간 이미 수명이 끝났다면
         화면에만 남아 있던 것이라, 그걸로 지게 하면 억울합니다 */
      if (!piece || piece.diesAt <= Date.now()) return;

      if (piece.kind !== 'songpyeon') {
        fail('wrong');
        return;
      }

      if (stageRef.current >= STAGE_COUNT) {
        clear();
        return;
      }

      beginStage(stageRef.current + 1);
    },
    [beginStage, clear, fail, status],
  );

  return {
    status,
    stage,
    pieces,
    stageStartedAt,
    failReason,
    resultOpen,
    dismissResult,
    start,
    catchPiece,
  };
}
