import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { House, Music, Sparkles, Ticket, UserRound, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/shared/constants';
import { cn, SPRING } from '@/shared/lib';

/**
 * 탭을 추가하려면 이 배열에 한 줄만 넣으면 됩니다.
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
const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: ROUTES.HOME, label: '홈', icon: House },
  { to: ROUTES.CONCERTS, label: '공연', icon: Music },
  { to: ROUTES.NFT_MARKET, label: '포카', icon: Sparkles },
  { to: ROUTES.MY_TICKETS, label: '내 티켓', icon: Ticket },
  { to: ROUTES.MY, label: 'MY', icon: UserRound },
];

/**
 * 아이콘이 앉는 자리. **정사각형**이어야 하이라이트가 원이 됩니다 —
 * 가로만 넓히면(예전 `h-9 w-14`) 알약이 되어 하단바가 무거워 보입니다.
 * 활성·비활성 모두 이 크기를 차지합니다. 크기가 달라지면 탭을 옮길 때마다 바가 들썩입니다.
 */
const ICON_BOX = 'size-10';

/**
 * 현재 경로에 해당하는 탭 하나를 고릅니다. (없으면 -1)
 *
 * NavLink 의 기본 isActive 는 "접두사 일치"라서 `/my/tickets` 에서
 * `/my` 탭까지 같이 켜집니다. 그렇다고 `/my` 에 end 를 주면
 * `/my/settings` 같은 하위 화면에서 아무 탭도 안 켜집니다.
 *
 * 그래서 **가장 길게 일치하는 탭 하나만** 활성으로 칩니다.
 *   /my/tickets  → '내 티켓' (`/my` 보다 길다)
 *   /my/settings → 'MY'
 */
function useActiveIndex(): number {
  const { pathname } = useLocation();

  return TABS.reduce((best, tab, index) => {
    const matched = tab.to === ROUTES.HOME ? pathname === ROUTES.HOME : pathname.startsWith(tab.to);
    if (!matched) return best;
    if (best < 0) return index;
    return tab.to.length > TABS[best]!.to.length ? index : best;
  }, -1);
}

export function BottomNav() {
  const activeIndex = useActiveIndex();

  return (
    <nav className="surface border-line pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto app-width border-t">
      <ul className="relative flex h-(--spacing-nav) items-stretch">
        {/* ── 움직이는 원 ──
            탭마다 원을 하나씩 두고 켜고 끄면 "뿅" 하고 순간이동합니다.
            원은 **하나**만 두고 자리를 옮깁니다.

            위치는 **인덱스 × 100%** 로 계산합니다 (칸 폭이 모두 같으므로 정확합니다).
            ⚠️ `layoutId`(공유 레이아웃)를 쓰지 마세요 — 뷰포트 기준으로 위치를 재는
               방식이라, 스크롤이 움직인 뒤에는 잰 값이 어긋나 원이 화면 밖에서
               날아 들어옵니다. (Segmented 에서 겪은 문제 — DESIGN.md 3장)

            세로 위치는 px 로 맞추지 않고 **탭과 같은 세로 배치를 그대로 흉내냅니다**
            (같은 gap + 라벨 한 줄). 아이콘·라벨 크기를 바꿔도 저절로 따라옵니다. */}
        {activeIndex >= 0 && (
          <motion.li
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-1"
            style={{ width: `calc(100% / ${TABS.length})` }}
            /* initial={false} — 처음 그릴 때는 애니메이션 없이 제자리에서 시작합니다.
               안 그러면 앱을 열 때마다 원이 왼쪽 끝에서 미끄러져 옵니다. */
            initial={false}
            animate={{ x: `${activeIndex * 100}%` }}
            transition={SPRING}
          >
            <span className={cn('surface-strong shadow-card rounded-full', ICON_BOX)} />
            {/* 라벨 한 줄만큼 자리를 차지하는 빈 줄 — 원을 아이콘 높이에 맞춥니다 */}
            <span className="text-[0.78125rem] leading-none">&nbsp;</span>
          </motion.li>
        )}

        {TABS.map(({ to, label, icon: Icon }, index) => {
          const isActive = activeIndex === index;

          return (
            <li key={to} className="flex-1">
              {/* NavLink 를 쓰지 않는 이유: NavLink 는 자체 접두사 매칭으로
                  aria-current 를 붙여버려서 위에서 계산한 활성 탭과 어긋납니다.
                  (`/my/tickets` 에서 `/my` 탭에도 aria-current 가 붙음)

                  z-10 — 아이콘·라벨이 움직이는 원 **위에** 와야 합니다. */}
              <Link
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative z-10 flex h-full flex-col items-center justify-center gap-1',
                  'transition-colors duration-150',
                  /* 라벨 색. 활성만 강조색입니다 — 이 바가 말하는 건
                     "지금 어디에 있나" 하나뿐이라 행동 버튼과 경쟁하지 않습니다.
                     비활성은 AA(4.5:1)를 겨우 넘기는 가장 옅은 값이라 더 밝히면
                     안 됩니다 — 상태 차이는 **면**으로 벌립니다. */
                  isActive ? 'text-accent-800' : 'text-ink-subtle hover:text-ink-muted',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center transition-colors duration-150',
                    ICON_BOX,
                    /* 원 위에 놓이는 아이콘만 흰색입니다.
                       ⚠️ `delay-150` — 원이 **도착한 뒤에** 흰색이 되게 미룹니다.
                          바로 흰색으로 바꾸면, 원이 오는 동안 흰 바탕에 흰 아이콘이 되어
                          잠깐 아이콘이 사라진 것처럼 보입니다.
                          (탭을 떠나는 쪽은 미루지 않습니다 — isActive 가 false 가 되는 순간
                           delay 클래스도 함께 빠져서 곧바로 회색으로 돌아옵니다) */
                    isActive && 'text-white delay-150',
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
