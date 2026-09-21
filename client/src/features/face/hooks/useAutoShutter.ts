import { useEffect, useRef, useState } from 'react';

/**
 * 자동 셔터 — 품질이 <b>일정 시간 유지되면</b> 스스로 찍습니다.
 *
 * ── 왜 버튼을 없애나 ──────────────────────────────────────
 * 버튼을 누르는 순간 사람은 손가락을 움직입니다. 그 흔들림이 그대로 프레임에 남아
 * "흔들렸어요" 로 되돌아옵니다. 화면을 보며 버튼을 찾느라 시선도 정면에서 벗어납니다.
 * <b>가만히 있으면 찍히는</b> 편이 더 좋은 사진을 만듭니다.
 *
 * ── 왜 바로 안 찍고 유지를 보나 ───────────────────────────
 * 조건을 스치듯 만족한 한 프레임에 찍으면, 고개를 돌리는 도중의 애매한 얼굴이 잡힙니다.
 * {@code holdMs} 동안 <b>계속</b> 통과해야 찍으므로 자세가 자리를 잡은 뒤에 눌립니다.
 * 중간에 한 번이라도 깨지면 처음부터 다시 셉니다 — 그래서 {@link AutoShutter.progress}
 * 를 화면에 보여줘야 합니다. 안 보여주면 사람은 언제 찍히는지 몰라 계속 움직입니다.
 */
export interface AutoShutter {
  /** 0~1. 화면에 진행을 보여주세요 — 안 보이면 언제 찍히는지 알 수 없습니다 */
  progress: number;
  /** 지금 세고 있는가 */
  counting: boolean;
}

interface Options {
  /** 셔터를 쓸 상황인가 (카메라 켜짐·모델 준비됨·전송 중 아님) */
  armed: boolean;
  /** 지금 프레임이 품질 게이트를 통과했는가 */
  ready: boolean;
  /** 이만큼 계속 통과하면 찍습니다 */
  holdMs?: number;
  onFire: () => void;
}

const TICK_MS = 80;

export function useAutoShutter({ armed, ready, holdMs = 900, onFire }: Options): AutoShutter {
  const [heldMs, setHeldMs] = useState(0);

  /* 콜백을 참조로 들고 있어야 합니다. 의존성에 그대로 넣으면 부모가 리렌더할 때마다
     effect 가 재시작해서 **카운트가 영원히 0 으로 되돌아갑니다.** */
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const counting = armed && ready;

  useEffect(() => {
    if (!counting) {
      setHeldMs(0);
      return;
    }

    const startedAt = performance.now();
    let fired = false;

    const timer = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setHeldMs(elapsed);

      if (!fired && elapsed >= holdMs) {
        // 한 번만 쏩니다. 다시 세려면 ready 가 꺼졌다 켜져야 합니다
        fired = true;
        clearInterval(timer);
        onFireRef.current();
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [counting, holdMs]);

  return { progress: Math.min(1, heldMs / holdMs), counting };
}
