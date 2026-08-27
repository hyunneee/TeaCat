import { useEffect, useReducer } from 'react';

/**
 * 만료 시각까지 남은 초.
 *
 * 두 가지를 의도적으로 이렇게 만들었습니다.
 *
 * 1) 숫자를 state 에 담아 1초씩 깎지 않고, **렌더할 때마다 `expiresAt - now` 를 다시 잽니다.**
 *    모바일에서 탭이 백그라운드로 가면 타이머가 throttling 돼서 카운트가 밀립니다.
 *    좌석 점유 타이머가 밀리면 "화면엔 3분 남았는데 서버는 이미 만료" 가 됩니다.
 *
 * 2) state 를 쓰면 `expiresAt` 이 null → 숫자로 바뀐 **첫 렌더에 0 이 반환**됩니다.
 *    (useState 초기화 함수는 마운트 때 한 번만 돌기 때문)
 *    그 0 을 보고 "만료됐다" 고 판단하는 쪽이 있으면 좌석을 잡자마자 풀어버립니다.
 *    파생 계산으로 두면 이 문제가 원천적으로 없습니다.
 *
 * interval 은 값을 만들지 않고 리렌더만 트리거합니다.
 */
export function useCountdown(expiresAt: number | null): number {
  const [, tick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}
