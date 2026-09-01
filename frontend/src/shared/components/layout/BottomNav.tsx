import { Link, useLocation } from 'react-router-dom';
import { House, Music, Sparkles, Ticket, UserRound, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/shared/lib';

/**
 * 탭을 추가하려면 이 배열에 한 줄만 넣으면 됩니다.
 *
 * ⚠️ **탭마다 아이콘은 하나입니다.** 활성/비활성에 서로 다른 글리프를 쓰지 마세요.
 *    같은 자리의 그림이 눌렀을 때 다른 그림으로 바뀌면, 밀도가 올라가는 게 아니라
 *    **다른 아이콘 세트를 섞어 쓴 것처럼** 보입니다 (선 굵기·모서리·비율이 다 다릅니다).
 *    `fill` 로 채우는 것도 금지입니다 — lucide 는 선 전용이라 겹친 선이 메워져 뭉갭니다.
 *
 *    활성 표시는 **아이콘 밖에서** 합니다 — 아이콘 뒤에 강조색 알약을 깔고
 *    그 안의 아이콘만 흰색으로 뒤집습니다. 그림 자체는 어느 탭에 있든 같은 모양입니다.
 *
 *    색·굵기만으로는 분간이 안 됩니다 (짙은 초록 vs 회색은 둘 다 '어두운 글리프').
 *    **면이 있고/없고**는 흘긋 봐도 보이고, 색을 못 보는 사람에게도 그대로 보입니다.
 */
const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: ROUTES.HOME, label: '홈', icon: House },
  { to: ROUTES.CONCERTS, label: '공연', icon: Music },
  { to: ROUTES.NFT_MARKET, label: '포카', icon: Sparkles },
  { to: ROUTES.MY_TICKETS, label: '내 티켓', icon: Ticket },
  { to: ROUTES.MY, label: 'MY', icon: UserRound },
];

/**
 * 현재 경로에 해당하는 탭 하나를 고릅니다.
 *
 * NavLink 의 기본 isActive 는 "접두사 일치"라서 `/my/tickets` 에서
 * `/my` 탭까지 같이 켜집니다. 그렇다고 `/my` 에 end 를 주면
 * `/my/settings` 같은 하위 화면에서 아무 탭도 안 켜집니다.
 *
 * 그래서 **가장 길게 일치하는 탭 하나만** 활성으로 칩니다.
 *   /my/tickets  → '내 티켓' (`/my` 보다 길다)
 *   /my/settings → 'MY'
 */
function useActiveTab(): string | null {
  const { pathname } = useLocation();

  return TABS.reduce<string | null>((best, tab) => {
    const matched = tab.to === ROUTES.HOME ? pathname === ROUTES.HOME : pathname.startsWith(tab.to);
    if (!matched) return best;
    return best === null || tab.to.length > best.length ? tab.to : best;
  }, null);
}

export function BottomNav() {
  const activeTab = useActiveTab();

  return (
    <nav className="surface border-line pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto app-width border-t">
      <ul className="flex h-(--spacing-nav) items-stretch">
        {TABS.map(({ to, label, icon: Icon }) => {
          const isActive = activeTab === to;

          return (
            <li key={to} className="flex-1">
              {/* NavLink 를 쓰지 않는 이유: NavLink 는 자체 접두사 매칭으로
                  aria-current 를 붙여버려서 위에서 계산한 활성 탭과 어긋납니다.
                  (`/my/tickets` 에서 `/my` 탭에도 aria-current 가 붙음) */}
              <Link
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-1',
                  'transition-colors duration-150',
                  /* 라벨 색. 활성만 강조색입니다 — 이 바가 말하는 건
                     "지금 어디에 있나" 하나뿐이라 행동 버튼과 경쟁하지 않습니다.
                     비활성은 AA(4.5:1)를 겨우 넘기는 가장 옅은 값이라 더 밝히면
                     안 됩니다 — 상태 차이는 **면**으로 벌립니다. */
                  isActive ? 'text-accent-800' : 'text-ink-subtle hover:text-ink-muted',
                )}
              >
                {/* 아이콘 자리는 **활성·비활성이 같은 크기**입니다 (h-9 w-14).
                    활성일 때만 배경이 생기게 해야 아이콘·라벨이 제자리에 머뭅니다 —
                    크기가 바뀌면 탭을 옮길 때마다 하단바가 들썩입니다. */}
                <span
                  className={cn(
                    'flex h-9 w-14 items-center justify-center rounded-full',
                    'transition-colors duration-150',
                    /* 강조색 면 + 흰 아이콘. 이 앱에서 초록이 쓰이는 자리 중
                       "지금 선택된 것" 에 해당합니다. (DESIGN.md 1장)
                       한 화면에 이 면은 **하나**뿐이라 행동 버튼과 경쟁하지 않습니다. */
                    isActive && 'bg-accent-700 text-white shadow-card',
                  )}
                >
                  <Icon size={24} strokeWidth={isActive ? 2.2 : 1.8} />
                </span>
                <span
                  className={cn(
                    'text-[0.78125rem] leading-none',
                    isActive ? 'font-bold' : 'font-medium',
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
