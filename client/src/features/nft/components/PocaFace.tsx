interface Props {
  /** 좋은 카드인가 — 테두리와 둘레 빛의 색을 정합니다 (금색 / 보라) */
  glow: boolean;
  /** 180° 돌려 둘 면. 두 면을 겹쳐 놓고 하나만 돌리면 앞뒤가 됩니다 */
  flipped?: boolean;
  children: React.ReactNode;
}

/**
 * 카드 한 면. 뽑기 연출(`PocaReveal`)과 크게 보기(`PocaSpotlight`)가 같이 씁니다.
 *
 * 🔴 사방으로 퍼지는 **어두운** 그림자는 쓰면 안 됩니다 — 뒤에 밝은 후광이 깔려 있어서
 * 카드 둘레의 빛만 깎아내 '어두운 네모 테두리' 가 생깁니다.
 * 아래로 치우친 짧은 그림자여야 테두리가 아니라 '떠 있는 깊이' 로 읽힙니다.
 */
export function PocaFace({ glow, flipped = false, children }: Props) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-2xl bg-white [backface-visibility:hidden]"
      style={{
        transform: flipped ? 'rotateY(180deg)' : undefined,
        boxShadow: [
          `0 0 0 1.5px ${glow ? 'var(--color-poca-gold)' : 'var(--color-poca-violet)'}`,
          '0 14px 26px -8px rgba(20,14,4,.62)',
          `0 0 34px ${glow ? 'var(--color-poca-gold-glow)' : 'var(--color-poca-violet-glow)'}`,
        ].join(', '),
      }}
    >
      {children}
    </div>
  );
}
