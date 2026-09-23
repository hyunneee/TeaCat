import { useLocation } from 'react-router-dom';
import {
  House,
  Music,
  PawPrint,
  Sparkles,
  Store,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/shared/constants';

export interface NavTab {
  to: string;
  label: string;
  icon: LucideIcon;
  /**
   * 이 탭이 함께 받는 경로들.
   *
   * 접두사 규칙만으로는 안 되는 화면을 적습니다 — 예를 들어 내 포카(`/my/nfts`)는
   * `/my` 에도 걸려서, 적어 두지 않으면 포카를 보고 있는데 `마이` 탭이 켜집니다.
   */
  alsoMatches?: string[];
}

/** 내 포카에 딸린 화면들. 어느 탭이 받든 이 묶음은 같이 움직입니다 */
const MY_POCA_PATHS = [ROUTES.MY_AUCTIONS, ROUTES.MY_BIDS, ROUTES.MY_STICKERS];

/**
 * 폰 하단 탭.
 *
 * ⚠️ **탭마다 아이콘은 하나입니다.** 활성/비활성에 서로 다른 글리프를 쓰지 마세요.
 *    같은 자리의 그림이 눌렀을 때 다른 그림으로 바뀌면, 밀도가 올라가는 게 아니라
 *    **다른 아이콘 세트를 섞어 쓴 것처럼** 보입니다 (선 굵기·모서리·비율이 다 다릅니다).
 *    `fill` 로 채우는 것도 금지입니다 — lucide 는 선 전용이라 겹친 선이 메워져 뭉갭니다.
 *
 *    활성 표시는 **아이콘 밖에서** 합니다 — 아이콘 뒤에 강조색 원을 깔고
 *    그 안의 아이콘만 흰색으로 뒤집습니다. 그림 자체는 어느 탭에 있든 같은 모양입니다.
 *
 *    색·굵기만으로는 분간이 안 됩니다 (짙은 초록 vs 회색은 둘 다 '어두운 글리프').
 *    **면이 있고/없고**는 흘긋 봐도 보이고, 색을 못 보는 사람에게도 그대로 보입니다.
 */
export const TABS: NavTab[] = [
  { to: ROUTES.HOME, label: '홈', icon: House },
  { to: ROUTES.CONCERTS, label: '공연', icon: Music },
  /* 폰에서는 마켓과 내 포카가 **한 칸**입니다. 다섯 칸에 여섯 번째를 끼우면 글자가
     줄어들고, '마켓' 과 '포카' 처럼 뜻이 가까운 두 칸이 나란히 있으면 작게 봤을 때
     글자만 다른 같은 자리로 읽힙니다. 내 포카 진입은 포카 머리말의 버튼 하나입니다. */
  {
    to: ROUTES.NFT_MARKET,
    label: '포카',
    icon: Sparkles,
    alsoMatches: [ROUTES.MY_NFTS, ...MY_POCA_PATHS],
  },
  { to: ROUTES.TOKEN, label: '캣치', icon: PawPrint },
  { to: ROUTES.MY, label: '마이', icon: UserRound },
];

/**
 * 데스크톱 상단 탭.
 *
 * 🔴 **폰과 목록이 다릅니다.** 예전에는 같은 배열에서 MY 만 빼서 썼는데, 가로로 늘어선
 * 글자 탭은 칸이 훨씬 넓어서 폰의 제약(다섯 칸)을 그대로 따를 이유가 없습니다.
 * 그래서 폰에서 한 칸으로 합쳐 둔 **마켓과 내 포카를 여기서는 둘로 나눕니다.**
 * 탭을 추가할 때 **두 배열을 다 보세요** — 한쪽만 고치면 화면 크기에 따라 메뉴가 달라집니다.
 *
 * `마이` 가 없는 것은 1줄의 계정 링크(MY)가 그 자리를 대신하기 때문입니다.
 * 둘 다 두면 같은 곳으로 가는 링크가 머리말에 두 번 뜹니다.
 */
export const DESKTOP_TABS: NavTab[] = [
  { to: ROUTES.HOME, label: '홈', icon: House },
  { to: ROUTES.CONCERTS, label: '공연', icon: Music },
  { to: ROUTES.NFT_MARKET, label: '마켓', icon: Store },
  { to: ROUTES.MY_NFTS, label: '포카', icon: Sparkles, alsoMatches: MY_POCA_PATHS },
  { to: ROUTES.TOKEN, label: '캣치', icon: PawPrint },
];

/**
 * 아이콘이 앉는 자리. **정사각형**이어야 하이라이트가 원이 됩니다 —
 * 가로만 넓히면(예전 `h-9 w-14`) 알약이 되어 바가 무거워 보입니다.
 * 활성·비활성 모두 이 크기를 차지합니다. 크기가 달라지면 탭을 옮길 때마다 바가 들썩입니다.
 */
export const ICON_BOX = 'size-10';

/**
 * 지금 경로가 어느 탭인지. (없으면 -1)
 *
 * 규칙은 하나입니다 — **가장 길게 맞는 경로를 가진 탭이 이깁니다.** `to` 와
 * `alsoMatches` 를 같은 자격으로 견주므로, `/my/nfts`(9자)가 `/my`(3자)를 이겨
 * 내 포카 화면에서 `마이` 탭이 켜지지 않습니다.
 *
 * 홈만 예외로 **정확히 일치**해야 합니다. `/` 는 모든 경로의 접두사라 그냥 두면 늘 켜집니다.
 */
export function activeIndexOf(tabs: NavTab[], pathname: string): number {
  let best = -1;
  let bestLength = -1;

  tabs.forEach((tab, index) => {
    const patterns = [tab.to, ...(tab.alsoMatches ?? [])];
    for (const pattern of patterns) {
      const matched =
        pattern === ROUTES.HOME ? pathname === ROUTES.HOME : pathname.startsWith(pattern);
      if (matched && pattern.length > bestLength) {
        best = index;
        bestLength = pattern.length;
      }
    }
  });

  return best;
}

/** 폰 하단 탭에서 지금 켜져 있는 칸 */
export function useActiveIndex(): number {
  return activeIndexOf(TABS, useLocation().pathname);
}

/** 데스크톱 상단 탭에서 지금 켜져 있는 칸 */
export function useActiveDesktopTo(): string | null {
  const { pathname } = useLocation();
  const index = activeIndexOf(DESKTOP_TABS, pathname);
  return index >= 0 ? DESKTOP_TABS[index]!.to : null;
}
