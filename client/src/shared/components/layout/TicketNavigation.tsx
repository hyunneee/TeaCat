import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/shared/lib';

export function TicketNavigation() {
  return (
    <nav aria-label="내 티켓 메뉴" className="border-line flex gap-6 border-b px-4 lg:hidden">
      {[
        { to: ROUTES.MY_TICKETS, label: '예매 내역' },
        { to: ROUTES.MY_RESALE, label: '취소표 대기 내역' },
      ].map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              'flex min-h-12 items-center border-b-2 text-sm font-semibold',
              isActive ? 'border-accent-800 text-accent-800' : 'text-ink-subtle border-transparent',
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
