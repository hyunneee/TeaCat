import { Link } from 'react-router-dom';
import { Coins } from 'lucide-react';
import { ROUTES } from '@/shared/constants';
import { useTokenBalance } from '../hooks/useTokenBalance';

/**
 * 데스크톱 상단 내비의 캣머니 칩 — MY 옆에 "지금 얼마 있나" 를 띄웁니다.
 *
 * <p>누르면 캣치로 갑니다. 잔액이 보이면 "그래서 뭘로 모으지" 가 바로 따라오는데,
 * 그 답이 있는 화면이 캣치입니다.
 *
 * <p>⚠️ **비로그인·로딩 중에는 아무것도 그리지 않습니다.** 0 을 띄우면 잔액이 없는 것처럼
 * 보이고, 자리를 잡아 두면 로그인할 때 머리말이 덜컥 움직입니다.
 *
 * <p>🔴 이 컴포넌트가 `features/token` 에 있는 이유는 `shared` 가 도메인을 모르기 때문입니다
 * (client/CLAUDE.md 3-2 — ESLint 가 막습니다). 상단 내비는 `shared` 라 이걸 직접 못 부르고,
 * 라우터(`app` 레이어)가 `AppLayout` 에 넘겨 줍니다.
 */
export function CatMoneyChip() {
  const { data: token } = useTokenBalance();

  if (!token) return null;

  return (
    <Link
      to={ROUTES.TOKEN}
      className="surface-2 text-ink-muted hover:text-ink flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
    >
      <Coins size={15} className="text-brand-500" aria-hidden />
      <span className="tabular-nums">{token.available.toLocaleString()}</span>
      <span className="sr-only">캣머니</span>
    </Link>
  );
}
