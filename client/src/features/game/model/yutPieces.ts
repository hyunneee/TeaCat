import { Bird, Cat, Dog, Fish, Rabbit, Turtle } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import type { GamePieceStyle } from './game.types';
import { Monkey, Sheep } from '../components/AnimalIcons';

/**
 * 말 모양. 서버 `GamePieceStyle` 과 1:1 입니다.
 *
 * 🔴 **자리 색만으로는 내 말을 못 찾습니다.** 판 위의 말은 지름 20px 짜리 동그라미라
 * 네 가지 색이 비슷한 채도로 섞이면 한눈에 구분되지 않습니다. 모양이 다르면 색맹인
 * 사람도, 작은 화면에서도 자기 말을 짚을 수 있습니다 — 그래서 한 방에서 겹치지
 * 않게 서버가 막습니다.
 */
interface PieceStyle {
  key: GamePieceStyle;
  label: string;
  /* lucide 아이콘(ForwardRef)과 직접 그린 아이콘(평범한 함수)을 **같이** 담습니다.
     `LucideIcon` 으로 좁히면 직접 그린 쪽이 안 들어갑니다 (`components/AnimalIcons`) */
  icon: ComponentType<LucideProps>;
}

/** 아직 못 고른 사람을 그릴 때 쓰는 기본값 */
const FALLBACK: PieceStyle = { key: 'CAT', label: '고양이', icon: Cat };

export const PIECE_STYLES: PieceStyle[] = [
  FALLBACK,
  { key: 'DOG', label: '강아지', icon: Dog },
  { key: 'RABBIT', label: '토끼', icon: Rabbit },
  { key: 'BIRD', label: '새', icon: Bird },
  { key: 'FISH', label: '물고기', icon: Fish },
  { key: 'TURTLE', label: '거북이', icon: Turtle },
  /* 🔴 lucide 에 원숭이·양이 없어서 같은 규격으로 직접 그렸습니다 (`components/AnimalIcons`).
     이모지를 박으면 기기마다 다른 그림이 나오고 선 굵기도 안 맞습니다 */
  { key: 'MONKEY', label: '원숭이', icon: Monkey },
  { key: 'SHEEP', label: '양', icon: Sheep },
];

const BY_KEY = new Map(PIECE_STYLES.map((style) => [style.key, style]));

/** 아직 안 골랐거나 서버가 새 모양을 늘렸으면 고양이로 그립니다 — 빈 칸보다는 낫습니다 */
export function pieceStyleOf(style: GamePieceStyle | null | undefined): PieceStyle {
  return (style ? BY_KEY.get(style) : undefined) ?? FALLBACK;
}

/** 고를 수 있는 말 수. 서버 CHECK 제약(1~4)과 같아야 합니다 */
export const PIECE_COUNTS = [1, 2, 3, 4] as const;
