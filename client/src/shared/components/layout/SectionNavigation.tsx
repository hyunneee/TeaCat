import { Link, useLocation } from 'react-router-dom';
import { sectionNavigation } from './sectionNavigation.model';
import { cn } from '@/shared/lib';

/** 데스크톱 하위 화면에서 주요 메뉴 대신 현재 작업 영역을 보여 준다. */
export function SectionNavigation() {
  const { pathname, search } = useLocation();
  const section = sectionNavigation(pathname);
  if (/^\/concerts\/\d+$/.test(pathname) && new URLSearchParams(search).get('preview') === '1')
    return null;
  if (!section) return null;
  return (
    <nav
      aria-label={section.label}
      className="border-line hidden gap-6 overflow-x-auto border-b lg:flex"
    >
      {section.items.map(({ to, label, active }) => (
        <Link
          key={to}
          to={to}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex min-h-12 shrink-0 items-center border-b-2 text-sm font-semibold',
            active ? 'border-accent-800 text-accent-800' : 'text-ink-subtle border-transparent',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
