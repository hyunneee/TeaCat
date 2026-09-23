import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { nftApi, nftKeys } from '../api/nftApi';
import type { PocaDrawResult } from '../model/nft.types';

/**
 * 개봉 단계.
 *
 *   sealed    봉지가 그대로 — 자르기를 기다립니다
 *   cutting   자르는 중 — 이때 뽑기 API 가 나갑니다
 *   opening   다 잘림 — 봉지가 벗겨지고 카드가 올라옵니다
 *   revealed  카드가 앞면으로 안착
 */
export type DrawPhase = 'sealed' | 'cutting' | 'opening' | 'revealed';

/** 봉지가 벗겨지고 카드가 앞면으로 앉기까지 (PocaReveal 의 애니메이션 길이와 맞춥니다) */
const REVEAL_MS = 2200;

/**
 * 포카 뽑기.
 *
 * ⭐ **API 를 언제 부르는지**가 이 훅의 핵심입니다.
 *
 * 🔴 **끝까지 잘린 뒤에 부릅니다.** 예전에는 첫 손가락이 닿는 순간 불렀습니다 —
 * 뜯는 1~2초를 로딩 시간으로 쓰려던 것인데, **뜯다가 멈추면 그 팩이 그대로
 * 사라졌습니다.** 절취선 근처를 한 번 누르기만 해도 카드가 발행돼서, 뽑은 적이
 * 없는 사람에게 "이미 뽑았어요" 가 떴습니다. 온체인이라 되돌릴 수도 없습니다.
 *
 * 응답을 기다리는 시간은 봉지가 벗겨지는 연출(`REVEAL_MS`)이 덮고, 그보다 늦어지면
 * `isWaiting` 으로 기다린다고 알려줍니다. 매끄러움보다 **안 뜯은 팩을 지키는 쪽**이
 * 먼저입니다.
 */
export function usePocaDraw() {
  const [phase, setPhase] = useState<DrawPhase>('sealed');
  const [card, setCard] = useState<PocaDrawResult | null>(null);
  /** 서버가 현재 개봉을 막은 확정 사유. 409 전체를 한 상태로 묶지 않습니다. */
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  /* 멱등키는 한 번 만들어 재시도에도 재사용합니다. 매번 새로 만들면 의미가 없습니다. */
  const idempotencyKey = useRef(crypto.randomUUID());
  /**
   * 이번 봉지에서 이미 뽑기를 보냈는가.
   * 🔴 상태가 아니라 ref 입니다 — 상태로 막으면 같은 프레임에 두 번 들어온 손가락이
   * 둘 다 옛 값을 보고 통과합니다.
   */
  const requested = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 목록·남은 팩 갱신을 **연출이 끝난 뒤로** 미룹니다.
   *
   * 🔴 카드가 도착하자마자 무효화하면 이 화면에 켜져 있는 `useDrawAvailability` 가
   * 곧바로 다시 요청을 보내고, 그 응답이 **카드가 떠오르는 중에** 리렌더를 일으켜
   * 애니메이션이 한 번 툭 끊깁니다. 갱신이 몇 초 늦어도 아무도 손해 보지 않습니다.
   */
  const pendingRefresh = useRef(false);

  const flushRefresh = useCallback(() => {
    if (!pendingRefresh.current) return;
    pendingRefresh.current = false;
    void queryClient.invalidateQueries({ queryKey: nftKeys.all });
  }, []);

  const draw = useMutation({
    mutationFn: () => nftApi.draw(idempotencyKey.current),
    /* 뽑기는 재시도 금지 — 자동 재시도가 붙으면 두 장이 나갈 수 있습니다 */
    retry: false,
    onSuccess: async (result) => {
      setBlockedMessage(null);
      /* 카드가 뒤집히는 순간 이미지가 없으면 흰 면이 한 프레임 보입니다.
         뜯는 동안 미리 받아 둡니다. 실패해도 연출은 그대로 진행합니다. */
      if (result.imageUrl) {
        const img = new Image();
        img.src = result.imageUrl;
        await img.decode().catch(() => undefined);
      }
      setCard(result);
      pendingRefresh.current = true;
    },
    onError: (error) => {
      const failure = ApiError.isApiError(error) ? error : null;

      /* 팩 없음·풀 준비 중·지갑 없음만 화면을 막습니다. 잠금 경합(NFT_060)은
         잠시 뒤 같은 멱등키로 다시 뜯을 수 있어야 하므로 토스트만 보여줍니다. */
      if (failure && ['NFT_040', 'NFT_041', 'NFT_036'].includes(failure.code)) {
        setBlockedMessage(failure.message);
      } else if (failure?.code === 'NFT_060') {
        toast.info(failure.message);
      } else {
        toast.error(failure?.message ?? '뽑기에 실패했어요.');
      }
      void queryClient.invalidateQueries({ queryKey: nftKeys.drawAvailability() });

      /* 실패했으면 다시 뜯어볼 수 있어야 합니다 */
      requested.current = false;

      /* 🔴 벗겨지는 타이머가 살아 있으면 카드도 없는데 `revealed` 로 넘어갑니다 */
      if (timer.current) clearTimeout(timer.current);

      setPhase('sealed');
    },
  });

  /* 화면을 떠날 때 타이머가 살아 있으면 사라진 컴포넌트에 setState 합니다 */
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      /* 연출을 끝까지 못 보고 나가도 목록은 최신이어야 합니다 */
      flushRefresh();
    },
    [flushRefresh],
  );

  /**
   * 봉지에 손이 닿았습니다. **여기서는 아무것도 보내지 않습니다** —
   * 뜯다 만 봉지가 소모되면 안 됩니다. 자르는 모습만 보여줍니다.
   */
  const startCut = useCallback(() => {
    setPhase((prev) => (prev === 'sealed' ? 'cutting' : prev));
  }, []);

  /**
   * 다시 뽑기 — 팩이 남아 있을 때만 화면이 이 버튼을 보여줍니다.
   * 🔴 멱등키를 새로 만듭니다. 그대로 두면 서버가 앞선 뽑기와 같은 요청으로 보고
   * 같은 카드를 돌려줍니다(멱등의 목적이 그것입니다).
   */
  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    idempotencyKey.current = crypto.randomUUID();
    requested.current = false;
    draw.reset();
    setCard(null);
    setBlockedMessage(null);
    setPhase('sealed');
  }, [draw]);

  /**
   * 🔴 **카드가 도착한 뒤에** 착지 시각을 셉니다.
   *
   * 다 뜯은 순간부터 세면, 응답이 1.8초 걸렸을 때 회전(0.92s~1.74s)이 **뒷면인 채로**
   * 끝나 버리고 그림만 갈아끼워집니다 — "안 돌고 그냥 들어오는" 것처럼 보입니다.
   * 더 늦으면 뒷면인 채로 연출이 끝납니다.
   */
  useEffect(() => {
    if (phase !== 'opening' || card === null) return;

    timer.current = setTimeout(() => {
      setPhase('revealed');
      flushRefresh();
    }, REVEAL_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phase, card, flushRefresh]);

  /** 끝까지 잘렸습니다 — **이제야** 뽑기가 나갑니다 */
  const finishCut = useCallback(() => {
    /* 🔴 상태가 아니라 ref 로 막습니다. 상태로 막으면 같은 프레임에 두 번 들어온
       호출이 둘 다 옛 값을 보고 통과해서 카드가 두 장 나갑니다. */
    if (requested.current) return;
    requested.current = true;

    setPhase('opening');
    draw.mutate();
  }, [draw]);

  return {
    phase,
    card,
    /**
     * 카드 연출을 시작해도 되는가 — **응답이 도착한 뒤**입니다.
     * 봉지가 벗겨지는 것과 카드가 올라오는 것을 나눠 둔 이유입니다.
     */
    rising: card !== null && (phase === 'opening' || phase === 'revealed'),
    /** 다 뜯었는데 아직 응답을 못 받은 상태 — 화면이 기다린다고 알려줘야 합니다 */
    isWaiting: phase === 'opening' && card === null,
    startCut,
    finishCut,
    reset,
    /** 현재 개봉을 막는 서버 사유. 없으면 null */
    blockedMessage,
  };
}
