import { Link } from 'react-router-dom';
import { Logo } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/shared/lib';
import { ICON_BOX, TABS, useActiveIndex } from './navTabs';

/**
 * 데스크톱(lg 이상)의 좌측 내비. 폰의 하단 탭과 **같은 목록**(navTabs)을 세로로 세운 것입니다.
 *
 * 하단 탭을 그대로 두지 않는 이유: 넓은 화면에서 화면 맨 아래 가로바는 마우스로 가장 먼
 * 자리입니다. 폰에서 하단이 좋은 건 엄지가 거기 있기 때문이고, 그 전제가 사라집니다.
 *
 * 생김새는 하단 탭과 맞춥니다 — 활성 표시는 아이콘 뒤의 **강조색 원**이고, 아이콘 글리프는
 * 어느 상태에서든 같습니다 (navTabs 주석 참고). 어드민 콘솔의 짙은 사이드바와 달리 밝은
 * 면을 쓰는 이유는, 여기는 관람객 화면이라 어두운 면(70:25:5 의 25)을 크게 깔면
 * 홈 상단의 짙은 면과 경쟁하기 때문입니다.
 *
 * 움직이는 원(motion)은 두지 않았습니다. 가로 탭에서는 원이 옆으로 미끄러지는 게 자연스럽지만,
 * 세로로 길게 늘어선 목록에서는 위아래로 훑고 지나가 시선을 끕니다.
 */
export function SideNav() {
  const activeIndex = useActiveIndex();

  return (
    <nav className="surface border-line sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r px-3 py-5 lg:flex">
      <Link to={ROUTES.HOME} aria-label="티캣 홈" className="mb-4 px-2">
        <Logo size={22} markSize={33} />
      </Link>

      <ul className="flex flex-col gap-1">
        {TABS.map(({ to, label, icon: Icon }, index) => {
          const isActive = activeIndex === index;

          return (
            <li key={to}>
              {/* NavLink 를 쓰지 않는 이유는 하단 탭과 같습니다 — 자체 접두사 매칭이
                  useActiveIndex 와 어긋납니다 (`/my/tickets` 에서 `/my` 도 켜짐) */}
              <Link
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl pr-3 text-sm font-semibold',
                  'transition-colors duration-150',
                  isActive ? 'text-accent-800' : 'text-ink-subtle hover:text-ink-muted',
                )}
              >
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-full transition-colors duration-150',
                    ICON_BOX,
                    isActive && 'surface-strong shadow-card',
                  )}
                >
                  <Icon size={21} strokeWidth={isActive ? 2.1 : 1.8} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
