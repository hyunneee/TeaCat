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
 * 다 자른 뒤에 부르면 연출이 끝난 자리에서 응답을 기다리며 멈춥니다.
 * 화면에 들어오자마자 부르면 뜯지도 않았는데 카드가 발행됩니다.
 *
 * 그래서 **첫 손가락이 닿는 순간** 호출합니다. 뜯는 1~2초가 자연스러운
 * 로딩 시간이 되고, 다 뜯었을 때는 이미지까지 준비돼 있습니다.
 */
export function usePocaDraw() {
  const [phase, setPhase] = useState<DrawPhase>('sealed');
  const [card, setCard] = useState<PocaDrawResult | null>(null);

  /* 멱등키는 한 번 만들어 재시도에도 재사용합니다. 매번 새로 만들면 의미가 없습니다. */
  const idempotencyKey = useRef(crypto.randomUUID());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draw = useMutation({
    mutationFn: () => nftApi.draw(idempotencyKey.current),
    /* 뽑기는 재시도 금지 — 자동 재시도가 붙으면 두 장이 나갈 수 있습니다 */
    retry: false,
    onSuccess: async (result) => {
      /* 카드가 뒤집히는 순간 이미지가 없으면 흰 면이 한 프레임 보입니다.
         뜯는 동안 미리 받아 둡니다. 실패해도 연출은 그대로 진행합니다. */
      if (result.imageUrl) {
        const img = new Image();
        img.src = result.imageUrl;
        await img.decode().catch(() => undefined);
      }
      setCard(result);
      void queryClient.invalidateQueries({ queryKey: nftKeys.all });
    },
    onError: (error) => {
      toast.error(ApiError.isApiError(error) ? error.message : '뽑기에 실패했어요.');
      setPhase('sealed');
    },
  });

  /* 화면을 떠날 때 타이머가 살아 있으면 사라진 컴포넌트에 setState 합니다 */
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /** 봉지에 손이 닿았습니다 — 여기서 뽑기가 나갑니다 */
  const startCut = useCallback(() => {
    setPhase((prev) => {
      if (prev !== 'sealed') return prev;
      draw.mutate();
      return 'cutting';
    });
  }, [draw]);

  /** 다 잘렸습니다 */
  const finishCut = useCallback(() => {
    setPhase((prev) => (prev === 'cutting' ? 'opening' : prev));
    timer.current = setTimeout(() => setPhase('revealed'), REVEAL_MS);
  }, []);

  /** 한 번 더 */
  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    idempotencyKey.current = crypto.randomUUID();
    draw.reset();
    setCard(null);
    setPhase('sealed');
  }, [draw]);

  return {
    phase,
    card,
    /** 다 뜯었는데 아직 응답을 못 받은 상태 — 화면이 기다린다고 알려줘야 합니다 */
    isWaiting: phase === 'opening' && card === null,
    startCut,
    finishCut,
    reset,
  };
}
