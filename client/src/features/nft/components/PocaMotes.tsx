import { useMemo } from 'react';

interface Props {
  /** 몇 개 뿌릴지 */
  count: number;
  /** 좋은 카드인가 — 금색 / 보라 */
  glow: boolean;
}

/**
 * 카드 둘레 고리에 뿌리는 빛 알갱이. 뽑기 연출과 크게 보기가 같이 씁니다.
 *
 * 사진 위는 덮지 않습니다 — 카드 타원 **바깥(1.05~1.85배)** 에만 놓습니다.
 * 고리 위에만 놓으면 띠처럼 몰려 보이고, 주기가 같으면 규칙이 눈에 잡힙니다.
 * 그래서 자리·크기·주기를 하나씩 흩뿌립니다.
 */
export function PocaMotes({ count, glow }: Props) {
  /* 한 번만 정합니다 — 매 렌더 새로 뽑으면 알갱이가 순간이동합니다 */
  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const radius = 1.05 + Math.random() * 0.8;
        return {
          id: i,
          left: `${50 + Math.cos(angle) * 34 * radius}%`,
          top: `${50 + Math.sin(angle) * 38 * radius}%`,
          size: 1.8 + Math.random() * 3.6,
          delay: Math.random() * 3,
          duration: 3.2 + Math.random() * 2.8,
        };
      }),
    [count],
  );

  return (
    /* 🔴 pointer-events-none — 장식이 손가락을 가로채면 그 아래 버튼이 안 눌립니다.
       자리 잡힌 요소는 칠하기 순서상 static 인 버튼보다 위에 놓입니다. */
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      {motes.map((m) => (
        <span
          key={m.id}
          className="motion-safe:animate-poca-mote absolute rounded-full"
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
            background: glow ? 'var(--color-poca-gold)' : 'var(--color-poca-violet)',
            boxShadow: `0 0 9px 2px ${glow ? 'var(--color-poca-gold-glow)' : 'var(--color-poca-violet-glow)'}`,
          }}
        />
      ))}
    </div>
  );
}
