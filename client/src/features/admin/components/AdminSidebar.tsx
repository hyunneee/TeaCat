import { NavLink } from 'react-router-dom';
import {
  Armchair,
  Building2,
  ChartLine,
  GalleryHorizontalEnd,
  LayoutDashboard,
  MessagesSquare,
  Images,
  Sparkles,
  Music,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib';
import { ROUTES } from '@/shared/constants';
import { Logo } from '@/shared/components/ui';
import { can, type User } from '@/features/auth';

/**
 * 사이드바 메뉴.
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │  🔴 메뉴를 추가할 때 손댈 곳은 **이 배열 한 곳**입니다.     │
 * │                                                           │
 * │   1. shared/constants/routes.ts 에 경로 추가               │
 * │   2. 아래 배열에 한 줄 추가                                │
 * │   3. app/router/router.tsx 의 admin 자식에 라우트 추가     │
 * └───────────────────────────────────────────────────────────┘
 *
 * `visible` 은 **서버 권한과 같아야** 합니다. 서버가 403 을 주는 메뉴를
 * 보여주면 눌렀을 때 실패하는 화면이 됩니다. 판단은 `features/auth` 의
 * `can` 한곳에 모여 있으니 거기에 규칙을 추가하고 여기서 부르세요.
 */
interface AdminMenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** 이 사용자에게 보일지. 없으면 항상 보입니다 */
  visible?: (user: User | null) => boolean;
  /** 하위 경로까지 활성으로 볼지 (기본은 정확히 일치할 때만) */
  matchNested?: boolean;
}

const ADMIN_MENU: AdminMenuItem[] = [
  { to: ROUTES.ADMIN, label: '대시보드', icon: LayoutDashboard },
  {
    to: ROUTES.ADMIN_ANALYTICS,
    label: '운영 통계',
    icon: ChartLine,
    visible: can.viewAnalytics,
    matchNested: true,
  },
  {
    to: ROUTES.ADMIN_CONCERTS,
    label: '공연 관리',
    icon: Music,
    visible: can.manageConcert,
    matchNested: true,
  },
  {
    to: ROUTES.ADMIN_STADIUMS,
    label: '공연장 목록',
    icon: Building2,
    visible: can.manageStadiumLayouts,
    matchNested: true,
  },
  {
    to: ROUTES.ADMIN_STADIUM,
    label: '좌석 배치 관리',
    icon: Armchair,
    visible: can.manageStadiumLayouts,
    matchNested: true,
  },
  {
    to: ROUTES.ADMIN_USERS,
    label: '유저 관리',
    icon: Users,
    visible: can.manageUsers,
    matchNested: true,
  },
  {
    to: ROUTES.ADMIN_POCA_TEMPLATES,
    label: '카드 그림 관리',
    icon: Images,
    visible: can.accessAdmin,
    matchNested: true,
  },
  {
    to: ROUTES.ADMIN_POCA_DESIGNS,
    label: '이벤트 뽑기 풀',
    icon: Sparkles,
    visible: can.accessAdmin,
    matchNested: true,
  },
  {
    to: ROUTES.ADMIN_BANNERS,
    label: '메인 배너 관리',
    icon: GalleryHorizontalEnd,
    visible: can.manageBanners,
    matchNested: true,
  },
  {
    to: ROUTES.ADMIN_INQUIRIES,
    label: '문의 관리',
    icon: MessagesSquare,
    visible: can.manageInquiries,
    matchNested: true,
  },
];

export interface AdminSidebarProps {
  user: User | null;
  className?: string;
}

export function AdminSidebar({ user, className }: AdminSidebarProps) {
  const items = ADMIN_MENU.filter((item) => item.visible?.(user) ?? true);

  return (
    <aside
      className={cn(
        /* 어두운 면은 70:25:5 의 25(구조)입니다. brand 는 채도 0 이라
           초록(강조 5%)을 잡아먹지 않습니다. 선택된 메뉴만 초록입니다. */
        'bg-brand-900 flex w-60 shrink-0 flex-col gap-1 p-4 text-white',
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-2 px-2 py-1">
        <Logo className="h-6 w-auto" />
        <span className="text-sm font-semibold tracking-tight">운영 콘솔</span>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon, matchNested }) => (
          <NavLink
            key={to}
            to={to}
            end={!matchNested}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? // "지금 선택된 것" — 강조색을 쓰는 세 자리 중 하나입니다 (DESIGN.md 1장)
                    'bg-accent-700 font-semibold text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <Icon size={18} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      {items.length === 1 && (
        /* 대시보드만 보이는 역할에게 빈 사이드바를 설명 없이 보여주면 고장으로 읽힙니다.
           (STADIUM 은 공연장·좌석 배치, PERFORMANCE 는 공연 관리가 보입니다) */
        <p className="mt-3 px-3 text-xs leading-relaxed text-white/50">
          이 계정으로 쓸 수 있는 관리 메뉴가 아직 없어요. 기능이 추가되면 여기에 나타납니다.
        </p>
      )}
    </aside>
  );
}
