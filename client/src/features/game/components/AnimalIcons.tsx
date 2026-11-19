import type { LucideProps } from 'lucide-react';

/**
 * lucide 에 없는 동물.
 *
 * 🔴 **이모지를 박지 않습니다** (CLAUDE.md 3-5). 대신 lucide 와 **같은 규격**으로 그립니다 —
 * 24 격자, `fill: none`, `stroke: currentColor`, 굵기 2, 둥근 끝. 규격이 다르면 말 하나만
 * 선이 가늘거나 굵어서, 판 위에서 그 말만 다른 그림처럼 떠 보입니다.
 *
 * 🔴 `LucideProps` 를 그대로 받습니다. `PIECE_STYLES` 의 `icon` 자리에 lucide 아이콘과
 * 섞여 들어가므로 타입도 쓰는 법도 같아야 합니다 (`size`, `className`, `strokeWidth`).
 *
 * 새 동물이 필요하면 **lucide 에 있는지 먼저 확인**하세요. 있으면 그걸 쓰고, 없을 때만
 * 여기에 한 칸을 더합니다.
 */

type Props = LucideProps;

/** lucide 기본값과 같습니다 — 넘기지 않았을 때 다른 아이콘과 같은 두께로 그려지도록 */
const BASE = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/**
 * 원숭이.
 *
 * 얼굴 윤곽 + 양옆 귀 + 눈·코로 그립니다. 귀가 바깥으로 크게 붙은 것이 이 그림의
 * 알아보는 지점이라, 작게 줄여도(판 위 20px) 토끼·고양이와 섞이지 않습니다.
 */
export function Monkey({ size = 24, strokeWidth = 2, ...rest }: Props) {
  return (
    <svg {...BASE} width={size} height={size} strokeWidth={strokeWidth} {...rest}>
      {/* 양옆 귀 — 얼굴보다 바깥으로 나와야 원숭이로 읽힙니다 */}
      <circle cx="4" cy="11" r="2.5" />
      <circle cx="20" cy="11" r="2.5" />
      {/* 얼굴 */}
      <path d="M17.5 11a5.5 5.5 0 0 0-11 0c0 3.6 2.5 6.5 5.5 6.5s5.5-2.9 5.5-6.5Z" />
      {/* 눈 */}
      <path d="M9.5 10.5h.01" />
      <path d="M14.5 10.5h.01" />
      {/* 주둥이 */}
      <path d="M9.5 14.5a3 3 0 0 0 5 0" />
    </svg>
  );
}

/**
 * 양.
 *
 * 뭉게뭉게한 털 윤곽 + 얼굴 + 말린 뿔입니다. 털의 둥근 덩어리들이 알아보는 지점이라
 * 아래쪽 다리는 그리지 않습니다 — 20px 에서는 선이 뭉쳐 덩어리로 보입니다.
 */
export function Sheep({ size = 24, strokeWidth = 2, ...rest }: Props) {
  return (
    <svg {...BASE} width={size} height={size} strokeWidth={strokeWidth} {...rest}>
      {/* 털 — 둥근 덩어리를 이어 붙인 윤곽 */}
      <path d="M7 8.5a3 3 0 1 0-2.4 4.8A3 3 0 0 0 7 18h7a3 3 0 0 0 2.6-4.5A3 3 0 0 0 15 8.5" />
      {/* 얼굴 */}
      <path d="M15 7.5a3 3 0 1 1 4.6 2.5c0 2-1.5 3.5-3.3 3.5S13 12 13 10.2" />
      {/* 말린 뿔 */}
      <path d="M19.8 7.2a1.6 1.6 0 1 0-2.3-2" />
      {/* 눈 */}
      <path d="M16.5 9.5h.01" />
    </svg>
  );
}
