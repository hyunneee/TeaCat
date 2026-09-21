import { useCallback } from 'react';
import { isAlreadyClaimed, useClaimSongpyeon, useDailyRewards } from './useDailyRewards';
import { useSongpyeonGame, type SongpyeonGame } from './useSongpyeonGame';

export interface SongpyeonChallenge {
  game: SongpyeonGame;
  /**
   * 오늘 이미 성공했는가.
   *
   * 🔴 **판단은 서버가 합니다.** 화면이 localStorage 로 기억하면 지우거나 다른 기기로
   * 열면 다시 받을 수 있습니다. 여기서는 그 답을 받아 보여주기만 합니다.
   */
  alreadyClaimed: boolean;
  /** 통과하면 들어오는 금액. 아직 못 받아왔으면 null */
  reward: number | null;
  /** 오늘 현황을 아직 받는 중 — 다 받기 전에는 시작시키지 않습니다 */
  loading: boolean;
  /** 통과 직후 지급을 청구하는 중 */
  claiming: boolean;
  /** 통과했는데 지급이 실패했다 (이미 받은 날은 실패가 아닙니다) */
  claimFailed: boolean;
  /** 지급 실패를 다시 시도합니다 */
  retryClaim: () => void;
  start: () => void;
}

/**
 * 송편 잡기 화면이 쓰는 전부 — 게임 + 오늘의 보상.
 *
 * 둘을 페이지에서 조립하면 "통과하면 청구한다 / 이미 받았으면 못 시작한다" 같은 규칙이
 * 페이지에 들어갑니다. 페이지가 하는 일은 배치뿐입니다. (CLAUDE.md 3-6)
 */
export function useSongpyeonChallenge(): SongpyeonChallenge {
  const { data: rewards, isLoading } = useDailyRewards();
  const claim = useClaimSongpyeon();
  const songpyeon = rewards?.SONGPYEON;

  /* 5단계를 통과한 순간 청구합니다. 통과 판정과 청구를 떼어 놓으면(예: 화면에서 effect 로)
     모달을 닫았다 열 때 또 나갑니다 — 서버가 409 로 막지만 굳이 보낼 이유가 없습니다 */
  const game = useSongpyeonGame({ onClear: () => claim.mutate() });

  /* 현황이 "안 받음" 이어도, 방금 청구가 409 면 오늘 몫은 이미 나간 것입니다
     (다른 기기에서 먼저 성공한 경우). 현황을 다시 받기 전까지의 한 박자를 이걸로 메꿉니다 */
  const alreadyClaimed = (songpyeon?.claimed ?? false) || isAlreadyClaimed(claim.error);

  const { start: startGame } = game;
  const start = useCallback(() => {
    // 오늘 몫이 끝났으면 판을 깔지 않습니다 — 이겨도 받을 게 없는 판입니다
    if (alreadyClaimed || isLoading) return;
    startGame();
  }, [alreadyClaimed, isLoading, startGame]);

  return {
    game,
    alreadyClaimed,
    reward: songpyeon?.amount ?? null,
    loading: isLoading,
    claiming: claim.isPending,
    claimFailed: claim.isError && !isAlreadyClaimed(claim.error),
    retryClaim: claim.mutate,
    start,
  };
}
