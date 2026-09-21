import { Apple, Cherry, Citrus, Cookie, Egg, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib';
import type { PieceKind } from '../model/songpyeonGame.model';

interface Props {
  kind: PieceKind;
  size?: number;
  className?: string;
}

/**
 * 판에 뜨는 그림 하나.
 *
 * 🔴 **송편만 색을 달리하지 않습니다.** 초록은 "지금 눌러야 할 것" 자리라(CLAUDE.md 4-6)
 * 송편에 칠하면 모양을 볼 필요가 없어져 게임이 사라집니다. 전부 같은 색으로 그리고
 * 눈이 모양을 찾게 합니다 — 짙은 면 위에 올라가므로 색은 물려받습니다.
 */
export function SongpyeonPiece({ kind, size = 30, className }: Props) {
  if (kind === 'songpyeon') {
    return <SongpyeonShape size={size} className={className} />;
  }

  const Icon = DECOY_ICON[kind];
  return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden />;
}

/**
 * 방해물 그림. lucide 에서 **송편과 크기·둥근 정도가 비슷한** 것들로 골랐습니다 —
 * 한눈에 갈리는 모양을 쓰면 속도를 올려도 어려워지지 않습니다.
 */
const DECOY_ICON: Record<Exclude<PieceKind, 'songpyeon'>, LucideIcon> = {
  chestnut: Egg,
  jujube: Cherry,
  pear: Apple,
  persimmon: Citrus,
  yakgwa: Cookie,
};

/**
 * 송편.
 *
 * 🔴 **lucide 에 송편이 없어서 직접 그립니다.** 이모지를 박는 대신(CLAUDE.md 3-5) lucide 와
 * 같은 규격 — 24 격자, 획 굵기, 둥근 끝 — 으로 맞춰 한 가족으로 보이게 했습니다.
 * 방해물과 선의 굵기가 다르면 모양을 보지 않고 **선만 보고** 구별할 수 있게 됩니다.
 *
 * 모양은 반달(몸통) + 아래 솔잎 두 가닥입니다. 반달만 두면 lucide 의 다른 아이콘과
 * 헷갈리고, 솔잎이 있어야 "찐 송편" 으로 읽힙니다.
 */
function SongpyeonShape({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
      aria-hidden
    >
      {/* 몸통 — 평평한 바닥 위에 올린 반달 */}
      <path d="M3.6 16.5c0-4.6 3.8-8.4 8.4-8.4s8.4 3.8 8.4 8.4z" />
      {/* 빚은 자국 하나. 이게 있어야 우산·해돋이 아이콘처럼 보이지 않습니다 */}
      <path d="M12 8.1v3.2" />
      {/* 솔잎 두 가닥 */}
      <path d="M8.2 19.2 6.4 21" />
      <path d="M15.8 19.2 17.6 21" />
    </svg>
  );
}
