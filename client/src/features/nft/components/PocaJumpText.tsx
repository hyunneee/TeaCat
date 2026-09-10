import { cn } from '@/shared/lib';

/** 앞 글자가 움직이고 다음 글자가 움직이기까지 — 이 간격이 파도를 만듭니다 */
const STEP_S = 0.07;

/**
 * 글자를 도톰하게 만드는 그림자.
 *
 * 같은 방향으로 1px 씩 어긋난 그림자를 겹치면 **글자가 눌러 붙은 두께**처럼 보입니다.
 * 그 아래 흐린 그림자 하나로 바닥에서 띄우고, 마지막에 등급 색 빛을 옅게 두릅니다.
 * (밝은 후광 위라 사방으로 퍼지는 어두운 그림자는 못 씁니다 — DESIGN.md 8장)
 */
function extrude(glow: boolean): string {
  const edge = glow ? '86,64,24' : '48,38,72';
  return [
    `0 1px 0 rgba(${edge},.85)`,
    `0 2px 0 rgba(${edge},.7)`,
    `0 3px 0 rgba(${edge},.55)`,
    `0 4px 0 rgba(${edge},.4)`,
    '0 7px 12px rgba(0,0,0,.45)',
    `0 0 18px ${glow ? 'var(--color-poca-gold-glow)' : 'var(--color-poca-violet-glow)'}`,
  ].join(', ');
}

interface Props {
  text: string;
  /** 좋은 카드인가 — **통통 뛰고 금색**, 아니면 부르르 떨고 보라색 */
  glow: boolean;
  /** 첫 움직임을 미루는 시간(초). 글씨가 다 뜬 뒤에 뛰게 할 때 씁니다 */
  delayS?: number;
  className?: string;
}

/**
 * 도톰한 큰 글씨 — 글자가 **하나씩 움직여 파도**를 만듭니다. 계속 반복합니다.
 *
 * 뽑기 결과 줄(`PocaResultLine`)과 크게 보기(`PocaSpotlight`)가 같이 씁니다.
 *
 * 🔴 두께(text-shadow)는 이 한 겹에만 겁니다 — 부모에 걸면 옆에 붙는 작은 글씨까지 번집니다.
 */
export function PocaJumpText({ text, glow, delayS = 0, className }: Props) {
  return (
    <span aria-hidden className={cn('font-black', className)} style={{ textShadow: extrude(glow) }}>
      {[...text].map((ch, i) => (
        <span
          key={i}
          className={cn(
            /* whitespace-pre — inline-block 이라 공백이 접혀 단어가 붙어버립니다 */
            'inline-block whitespace-pre',
            glow ? 'motion-safe:animate-poca-wave' : 'motion-safe:animate-poca-shake',
          )}
          style={{ animationDelay: `${(delayS + i * STEP_S).toFixed(3)}s` }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
