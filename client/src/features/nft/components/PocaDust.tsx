import { useMemo } from 'react';
import { isSpecial } from '../model/pocaDraw.model';
import type { PocaDrawResult } from '../model/nft.types';

/** 뭉치 수 — 화면을 덮어야 해서 카드 둘레만 채우던 때보다 넉넉합니다 */
const COUNT = 22;

interface Props {
  /** 봉지가 갈라지기 시작했는가 */
  opening: boolean;
  /** 뽑힌 카드. 꽝일 때만 먼지가 납니다 */
  card: PocaDrawResult | null;
}

/**
 * 꽝(개발자 카드)일 때 **화면 전체로** 확 퍼지는 먼지.
 *
 * 🔴 카드 안이 아니라 **무대 바로 밑**에 둡니다. 카드 상자 안에 두면 상승·부유
 * 애니메이션의 transform 을 같이 타서 먼지가 카드를 따라다니고, 상자 크기만큼만 퍼집니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 씁니다. (CLAUDE.md 4-3)
 */
export function PocaDust({ opening, card }: Props) {
  /* 자리·크기는 한 번만 정합니다. 매 렌더 새로 뽑으면 먼지가 순간이동합니다 */
  const puffs = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        id: i,
        size: 220 + Math.random() * 380,
        left: `${Math.random() * 100}%`,
        top: `${18 + Math.random() * 64}%`,
        dx: `${Math.round(Math.random() * 260 - 130)}px`,
        dy: `${Math.round(60 + Math.random() * 150)}px`,
        delay: Math.random() * 0.38,
      })),
    [],
  );

  if (!opening || !card || isSpecial(card.grade)) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {puffs.map((p) => (
        <span
          key={p.id}
          className="motion-safe:animate-poca-puff absolute rounded-full opacity-0 blur-[4px]"
          style={
            {
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              background: 'radial-gradient(circle, var(--color-poca-dust) 0%, transparent 74%)',
              '--dx': p.dx,
              '--dy': p.dy,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
