import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, UserRound } from 'lucide-react';
import { Logo } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/shared/lib';
import { TABS, useActiveIndex } from './navTabs';

/** 본문과 같은 폭으로 맞춥니다 — 로고가 본문 왼쪽 끝과 한 줄로 서야 기둥이 하나로 보입니다 */
const ROW = 'mx-auto flex w-full max-w-5xl items-center px-6';

/**
 * 데스크톱(lg 이상)의 상단 내비. 폰의 하단 탭과 **같은 목록**(navTabs)을 위로 올린 것입니다.
 *
 * 배치는 티켓 예매 사이트(NOL)의 머리말을 따릅니다 — 두 줄입니다.
 *
 *   1줄  로고 · 검색 · 계정
 *   2줄  가로 탭 (활성에 밑줄)
 *
 * 탭 표시를 폰의 "아이콘 뒤 강조색 원" 에서 **밑줄**로 바꾼 이유: 원은 아이콘이 세로로
 * 쌓인 좁은 칸에서 읽히는 표시입니다. 가로로 늘어선 글자 탭에 원을 깔면 알약이 되어
 * 머리말이 무거워지고, 바로 위 검색창과 덩어리가 겹쳐 보입니다.
 * 색은 그대로 강조색 하나만 씁니다 (70:25:5 의 5 — "지금 여기").
 *
 * 스크롤을 따라옵니다. 목록을 한참 내린 뒤 다른 곳으로 가려고 맨 위까지 되돌아가야 하면
 * 아무도 안 옮깁니다 — 폰에서 하단 탭이 늘 붙어 있는 것과 같은 이유입니다.
 */
export function TopNav() {
  const navigate = useNavigate();
  const activeIndex = useActiveIndex();
  const [keyword, setKeyword] = useState('');

  /* 검색은 통합 검색 화면이 받습니다. 적은 글자를 `?q=` 로 넘겨 그 화면이 이어서 씁니다 */
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = keyword.trim();
    navigate(q ? `${ROUTES.SEARCH}?q=${encodeURIComponent(q)}` : ROUTES.SEARCH);
  };

  return (
    <header className="surface border-line sticky top-0 z-30 hidden border-b lg:block">
      {/* ── 1줄 — 로고 · 검색 · 계정 ── */}
      <div className={cn(ROW, 'relative h-16 gap-6')}>
        <Link to={ROUTES.HOME} aria-label="티캣 홈" className="shrink-0">
          <Logo size={24} markSize={36} />
        </Link>

        {/* 검색창은 **화면 한가운데**입니다.
            흐름에 그대로 두면(`flex-1`) 로고 오른쪽에 붙어 왼쪽으로 쏠립니다.
            로고와 계정의 폭이 서로 달라 `mx-auto` 로도 진짜 가운데가 나오지 않아
            (남는 공간의 가운데일 뿐), 줄 기준으로 직접 가운데에 놓습니다.
            줄 폭은 최소 976px(64rem - px-6)이고 창은 448px 이라 좌우로 264px 씩
            남습니다 — 로고·계정과 겹치지 않습니다. */}
        <form
          role="search"
          onSubmit={submit}
          className="absolute left-1/2 w-full max-w-md -translate-x-1/2"
        >
          <div className="surface-sunken border-line flex h-10 items-center gap-2 rounded-full border px-4">
            <Search size={17} className="text-ink-subtle shrink-0" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="공연·포토카드 검색"
              aria-label="검색어"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </form>

        <Link
          to={ROUTES.MY}
          className="text-ink-subtle hover:text-ink-muted ml-auto flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors"
        >
          <UserRound size={18} />
          MY
        </Link>
      </div>

      {/* ── 2줄 — 가로 탭 ── */}
      <nav className={cn(ROW, 'h-11 gap-1')}>
        {TABS.map(({ to, label }, index) => {
          const isActive = activeIndex === index;

          return (
            /* NavLink 를 쓰지 않는 이유는 하단 탭과 같습니다 — 자체 접두사 매칭이
               useActiveIndex 와 어긋납니다 (`/my/tickets` 에서 `/my` 도 켜짐) */
            <Link
              key={to}
              to={to}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex h-full items-center px-4 text-sm font-semibold',
                'transition-colors duration-150',
                isActive ? 'text-accent-800' : 'text-ink-subtle hover:text-ink-muted',
              )}
            >
              {label}
              {/* 밑줄은 머리말의 아래 테두리 위에 겹쳐 놓습니다 (-bottom-px) —
                  테두리 아래에 두면 탭과 떨어져 보입니다 */}
              {isActive && <span className="bg-accent-800 absolute inset-x-3 -bottom-px h-0.5 rounded-full" />}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
