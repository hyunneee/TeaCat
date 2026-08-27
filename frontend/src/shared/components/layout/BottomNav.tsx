import { Link, useLocation } from 'react-router-dom';
import { House, Music, Sparkles, Ticket, User, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/shared/lib';

/** 탭을 추가하려면 이 배열에 한 줄만 넣으면 됩니다. */
const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: ROUTES.HOME, label: '홈', icon: House },
  { to: ROUTES.CONCERTS, label: '공연', icon: Music },
  { to: ROUTES.NFT_MARKET, label: '포카', icon: Sparkles },
  { to: ROUTES.MY_TICKETS, label: '내 티켓', icon: Ticket },
  { to: ROUTES.MY, label: 'MY', icon: User },
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
    <nav className="surface-glass border-line pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-screen-sm border-t">
      <ul className="flex h-(--spacing-nav) items-stretch px-1">
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
                  'flex h-full flex-col items-center justify-center gap-1 transition-colors duration-150',
                  isActive ? 'text-brand-700' : 'text-ink-subtle hover:text-ink-muted',
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="text-[0.6875rem] font-semibold">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
