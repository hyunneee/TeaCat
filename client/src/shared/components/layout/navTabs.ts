import { useLocation } from 'react-router-dom';
import { House, Music, PawPrint, Sparkles, UserRound, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/shared/constants';

/**
 * 하단 탭(폰)과 사이드 내비(데스크톱)가 **같은 목록**을 씁니다.
 * 탭을 추가하려면 이 배열에 한 줄만 넣으면 둘 다 따라옵니다.
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
export const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: ROUTES.HOME, label: '홈', icon: House },
  { to: ROUTES.CONCERTS, label: '공연', icon: Music },
  { to: ROUTES.NFT_MARKET, label: '포카', icon: Sparkles },
  /* 내 포카는 탭에서 뺐습니다 — '포카' 와 '내 포카' 두 칸이 나란히 있으면 작게 봤을 때
     글자만 다른 같은 자리로 읽힙니다. 진입은 포카 머리말의 '내 포카' 버튼 하나입니다. */
  { to: ROUTES.TOKEN, label: '캣치', icon: PawPrint },
  { to: ROUTES.MY, label: '마이', icon: UserRound },
];

/**
 * 아이콘이 앉는 자리. **정사각형**이어야 하이라이트가 원이 됩니다 —
 * 가로만 넓히면(예전 `h-9 w-14`) 알약이 되어 바가 무거워 보입니다.
 * 활성·비활성 모두 이 크기를 차지합니다. 크기가 달라지면 탭을 옮길 때마다 바가 들썩입니다.
 */
export const ICON_BOX = 'size-10';

/**
 * `포카` 탭이 받는 경로들.
 *
 * 마켓(`/nft`)뿐 아니라 **내 포카와 그 활동**까지 이 탭으로 묶습니다. 내 포카가 탭에서 빠지면서
 * 갈 곳이 없어졌는데, 그대로 두면 `/my` 접두사에 걸려 `마이` 탭이 켜집니다 — 포카를 보고 있는데
 * 마이가 켜진 상태가 됩니다. 거래 내역·경매·입찰·꾸미기도 같은 이유로 여기 넣습니다.
 */
const POCA_PATHS = [
  ROUTES.NFT_MARKET,
  ROUTES.MY_NFTS,
  ROUTES.MY_AUCTIONS,
  ROUTES.MY_BIDS,
  ROUTES.MY_STICKERS,
];

/**
 * 현재 경로에 해당하는 탭 하나를 고릅니다. (없으면 -1)
 *
 * 기본은 경로 접두사로 찾되, **포카 탭만 여러 경로를 받습니다**({@link POCA_PATHS}).
 * 내 티켓·설정·문의 등 나머지 `/my/*` 화면은 `마이` 탭이 받습니다.
 *
 * 🔴 `/my/nfts` 는 `/my` 에도 접두사로 걸립니다. 길이가 긴 쪽이 이기는 규칙으로는
 * 포카 탭의 `to`(`/nft`)가 `/my` 에 지므로, 포카는 길이와 무관하게 먼저 확정합니다.
 */
export function useActiveIndex(): number {
  const { pathname } = useLocation();

  if (POCA_PATHS.some((path) => pathname.startsWith(path))) {
    return TABS.findIndex((tab) => tab.to === ROUTES.NFT_MARKET);
  }

  return TABS.reduce((best, tab, index) => {
    const matched =
      tab.to === ROUTES.HOME ? pathname === ROUTES.HOME : pathname.startsWith(tab.to);
    if (!matched) return best;
    if (best < 0) return index;
    return tab.to.length > TABS[best]!.to.length ? index : best;
  }, -1);
}
