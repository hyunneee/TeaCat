import { useMemo, useState } from 'react';
import type { ConcertSummary } from '@/features/concert';
import { useMyConcerts } from './useMyConcerts';

/**
 * 어드민 콘솔의 공연 관리 목록 (Controller 레이어).
 *
 * 서버의 `/admin/concerts/mine` 이 **역할에 따라 다른 범위를 줍니다** — ADMIN 이면 등록자와
 * 무관하게 전부, 공연 주최자(PERFORMANCE)면 본인이 등록한 것만. 그래서 화면은 역할을
 * 따질 필요가 없고, 여기서도 `useMyConcerts` 를 그대로 씁니다.
 *
 * 🔴 검색은 **받아온 목록에서 화면이 거릅니다.** 서버에 검색 인자를 더하지 않은 이유는
 *    이 목록이 페이지네이션 없이 한 번에 오기 때문입니다 — 이미 손에 다 있는 것을
 *    다시 물어볼 이유가 없습니다. 공연이 수백 개를 넘어가 목록 자체를 잘라 보내야 할 때,
 *    그때 서버 검색으로 옮기면 됩니다.
 */
export function useManagedConcerts() {
  const [keyword, setKeyword] = useState('');
  const query = useMyConcerts();

  const concerts = useMemo(() => filterByTitle(query.data, keyword), [query.data, keyword]);

  return { ...query, concerts, keyword, setKeyword };
}

function filterByTitle(concerts: ConcertSummary[] | undefined, keyword: string) {
  if (!concerts) return undefined;

  const needle = keyword.trim().toLowerCase();
  if (!needle) return concerts;

  return concerts.filter((concert) => concert.title.toLowerCase().includes(needle));
}
