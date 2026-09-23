import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { Logo } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/shared/lib';
import { DESKTOP_TABS, useActiveDesktopTo } from './navTabs';
import { SearchEntryButton, TrendingSearchInput } from '@/shared/search';
import { useScrollNavigation } from './useScrollNavigation';
import { sectionNavigation } from './sectionNavigation.model';

/** 본문과 같은 폭으로 맞춥니다 — 로고가 본문 왼쪽 끝과 한 줄로 서야 기둥이 하나로 보입니다 */
const ROW = 'mx-auto flex w-full max-w-5xl items-center px-6';




/**
 * 데스크톱(lg 이상)의 상단 내비.
 *
 * 🔴 **폰의 하단 탭과 목록이 다릅니다** (`navTabs` 의 `DESKTOP_TABS`). 가로로 늘어선 글자
 * 탭은 칸이 훨씬 넓어서, 폰에서 한 칸으로 합쳐 둔 **마켓과 내 포카가 여기서는 둘로
 * 나뉩니다.** 탭을 고칠 때 두 배열을 다 보세요 — 한쪽만 고치면 화면 크기에 따라 메뉴가
 * 달라집니다.
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
interface TopNavProps {
  /**
   * MY 링크 **왼쪽**에 놓을 것 (지금은 캣머니 칩).
   *
   * 🔴 이 자리에 들어갈 것이 `features` 에 있어도 여기서 직접 부를 수 없습니다 — `shared` 는
   * 도메인을 모릅니다(CLAUDE.md 3-2). 넣어 주는 쪽은 `AppLayout` 을 렌더하는 라우터입니다.
   */
  action?: React.ReactNode;
}

export function TopNav({ action }: TopNavProps = {}) {
  const { headerRef, hidden, reveal } = useScrollNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const compact = sectionNavigation(location.pathname) !== null;
  const isSearch = location.pathname === ROUTES.SEARCH;
  const urlKeyword = new URLSearchParams(location.search).get('q') ?? '';
  const [keyword, setKeyword] = useState(urlKeyword);
  useEffect(() => setKeyword(urlKeyword), [urlKeyword, location.key]);
  const submit = (value: string) => {
    const query = value.trim();
    navigate(query ? `${ROUTES.SEARCH}?q=${encodeURIComponent(query)}` : ROUTES.SEARCH, {
      replace: true,
    });
  };
  const activeTo = useActiveDesktopTo();
  /* MY 는 탭 줄에 없으므로 따로 봅니다 — 마이페이지에서 머리말이 전부 회색이 되지 않게 */
  const myActive = location.pathname.startsWith(ROUTES.MY) && activeTo === null;

  return (
    <header
      ref={headerRef}
      data-nav-hidden={!compact && hidden}
      data-nav-compact={compact}
      onFocusCapture={reveal}
      className="desktop-navigation surface border-line sticky top-0 z-40 hidden border-b lg:block"
    >
      {/* ── 1줄 — 로고 · 검색 · 계정 ── */}
      <div className={cn(ROW, 'navigation-brand surface relative z-10 h-16 gap-6')}>
        <Link to={ROUTES.HOME} aria-label="TEACAT 홈" className="shrink-0">
          <Logo size={24} markSize={36} />
        </Link>

        {/* 검색창은 **화면 한가운데**입니다.
            흐름에 그대로 두면(`flex-1`) 로고 오른쪽에 붙어 왼쪽으로 쏠립니다.
            로고와 계정의 폭이 서로 달라 `mx-auto` 로도 진짜 가운데가 나오지 않아
            (남는 공간의 가운데일 뿐), 줄 기준으로 직접 가운데에 놓습니다.
            줄 폭은 최소 976px(64rem - px-6)이고 창은 448px 이라 좌우로 264px 씩
            남습니다 — 로고·계정과 겹치지 않습니다. */}
        {isSearch ? (
          <TrendingSearchInput
            variant="topnav"
            autoFocus
            value={keyword}
            onChange={setKeyword}
            onSubmit={submit}
            className="absolute left-1/2 w-full max-w-md -translate-x-1/2"
          />
        ) : (
          <SearchEntryButton
            onOpen={() => navigate(ROUTES.SEARCH)}
            className="absolute left-1/2 w-full max-w-md -translate-x-1/2"
          />
        )}

        {/* 캣머니 칩. 로그인했을 때만 자리를 차지합니다 (없으면 null 이라 MY 가 그대로 오른쪽 끝).
            `ml-auto` 가 여기로 옮겨 왔습니다 — 칩이 있을 때 둘이 함께 오른쪽에 붙어야 합니다. */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {action}

          {/* 탭 줄에서 뺀 MY 의 "지금 여기" 표시를 이 링크가 이어받습니다.
              어디에도 표시가 없으면 마이페이지에서 머리말이 전부 회색이 됩니다. */}
          <Link
            to={ROUTES.MY}
            aria-current={myActive ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors',
              myActive ? 'text-accent-800' : 'text-ink-subtle hover:text-ink-muted',
            )}
          >
            <UserRound size={18} />
            MY
          </Link>
        </div>
      </div>

      {/* ── 2줄 — 가로 탭. 줄 폭을 **똑같이 나눠** 가집니다 ── */}
      <nav
        aria-label="주요 메뉴"
        inert={hidden || compact}
        className={cn(ROW, 'h-11', compact && 'hidden')}
      >
        {DESKTOP_TABS.map(({ to, label }) => {
          const isActive = to === activeTo;

          return (
            /* NavLink 를 쓰지 않는 이유는 하단 탭과 같습니다 — 자체 접두사 매칭이
               activeIndexOf 와 어긋납니다 (`/my/tickets` 에서 `/my` 도 켜짐) */
            <Link
              key={to}
              to={to}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex h-full flex-1 items-center justify-center text-sm font-semibold',
                'transition-colors duration-150',
                isActive ? 'text-accent-800' : 'text-ink-subtle hover:text-ink-muted',
              )}
            >
              {/* 밑줄은 **글자 폭**입니다. 칸이 244px 이라 칸 전체에 그으면
                  밑줄이 아니라 구분선처럼 보입니다.
                  머리말 아래 테두리 위에 겹쳐 놓습니다 (-bottom-px) —
                  테두리 아래에 두면 탭과 떨어져 보입니다. */}
              <span className="relative flex h-full items-center">
                {label}
                {isActive && (
                  <span className="bg-accent-800 absolute inset-x-0 -bottom-px h-0.5 rounded-full" />
                )}
              </span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
