import { useCallback, useEffect } from 'react';
import { animate, useMotionValue } from 'motion/react';
import { EASE } from '@/shared/lib';

/** 빛이 카드를 한 번 훑는 데 걸리는 시간 */
const SWEEP_SECONDS = 1.05;

interface Options {
  /** 처음 한 번 훑기까지의 지연(ms). 화면에 자리를 잡은 뒤여야 "막 도착한 카드" 로 읽힙니다. */
  delayMs?: number;
  /** 이 간격(ms)마다 반복. 안 주면 **한 번만** 훑습니다. */
  repeatMs?: number;
  /** 꺼두기 (닫힌 오버레이 등) */
  enabled?: boolean;
}

/**
 * 포토카드 표면의 **빛 반사** 연출을 굴리는 값들.
 *
 * 화면(`PocaGlare`)은 이 두 값만 보고 그립니다 — 연출 규칙은 여기 한 곳입니다.
 *
 * ⚠️ 목록에는 쓰지 마세요. 카드 12장이 전부 반짝이면 아무것도 특별해 보이지 않고,
 *    무한 루프 반짝임은 전형적인 "AI 가 만든 티" 입니다. (DESIGN.md 8장)
 *    상세 화면의 **한 장**에만, 그리고 반복은 전체화면처럼 카드가 주인공일 때만.
 *
 * ⚠️ **`prefers-reduced-motion` 을 보지 않습니다 — 앱에서 여기만 예외입니다.**
 *
 *    안드로이드는 **절전 모드만 켜도** 이 값이 reduce 라, 존중하면 실제 사용자 상당수가
 *    죽어 있는 카드만 보게 됩니다. 움직임 대신 **정지 광택**으로 대체해 봤지만
 *    그건 "멈춰 있는 오류" 로 읽혔습니다.
 *
 *    이 연출은 카드 위에 반투명 띠 하나가 지나갈 뿐 **레이아웃을 밀지 않고** 진폭도
 *    작아서, reduce 가 막으려는 어지러움과는 거리가 멉니다. 그래서 반짝임만 예외로 두고
 *    **자리를 옮기는 연출(화면·목록 등장)은 계속 reduce 를 존중합니다.**
 *    (줄여야 한다면 지우지 말고 `repeatMs` 를 빼서 **한 번만** 훑게 하세요)
 */
export function useGlareSweep({ delayMs = 260, repeatMs, enabled = true }: Options = {}) {
  /** 빛의 가로 위치 (0 = 왼쪽 밖, 1 = 오른쪽 밖) */
  const glare = useMotionValue(0);
  /** 빛의 세기 (0~1) */
  const intensity = useMotionValue(0);

  const sweep = useCallback(() => {
    glare.set(0);
    intensity.set(0);
    animate(glare, 1, { duration: SWEEP_SECONDS, ease: EASE.out });
    animate(intensity, [0, 1, 1, 0], { duration: SWEEP_SECONDS, times: [0, 0.16, 0.6, 1] });
  }, [glare, intensity]);

  useEffect(() => {
    if (!enabled) return;

    const first = setTimeout(sweep, delayMs);
    if (!repeatMs) return () => clearTimeout(first);

    const timer = setInterval(sweep, repeatMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [sweep, delayMs, repeatMs, enabled]);

  return { glare, intensity, sweep };
}
