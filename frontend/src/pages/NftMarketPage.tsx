import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Images, Search, Sparkles } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Input, Segmented, Select } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useAuth } from '@/features/auth';
import {
  DEFAULT_SORT,
  NFT_SORTS,
  NftCard,
  useMyNfts,
  useNftMarket,
  type NftSort,
} from '@/features/nft';
import { useTokenBalance } from '@/features/token';

/** 마켓에서 보는 방향 — 사는 쪽인가, 파는 쪽인가 */
type Side = 'BUY' | 'SELL';

const SIDES = [
  { value: 'BUY', label: '구매' },
  { value: 'SELL', label: '판매' },
] as const satisfies readonly { value: Side; label: string }[];

/**
 * 포토카드 마켓.
 *
 * ── 화면 순서 ─────────────────────────────────────────────
 *   구매/판매 → 검색 → 잔액·정렬 → 2열 그리드
 *
 * ── 구매 / 판매 ───────────────────────────────────────────
 * 같은 화면에서 방향만 바꿉니다.
 *   구매 — 남들이 올린 카드 (마켓)
 *   판매 — 내가 가진 카드. 눌러 들어가면 상세에서 가격을 매겨 올립니다.
 * 화면을 둘로 나누면 "내 카드 팔려면 어디 가지?" 를 매번 찾게 됩니다.
 *
 * 등급(NORMAL/RARE/SPECIAL)은 없습니다. 카드의 가치는 등급표가 아니라
 * **어떤 공연의 어떤 순간인지**와 가격으로 정해집니다.
 */
export function NftMarketPage() {
  const navigate = useNavigate();
  const [side, setSide] = useState<Side>('BUY');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<NftSort>(DEFAULT_SORT);
  const { isLoggedIn } = useAuth();

  const trimmed = keyword.trim();
  const buying = side === 'BUY';

  const market = useNftMarket(buying ? trimmed || undefined : undefined, sort);
  const mine = useMyNfts();
  const { data: token } = useTokenBalance();

  /* 내 카드는 전부 받아 두고 화면에서 거릅니다 — 개수가 적어 서버를 또 부를 일이 아닙니다. */
  const myFiltered = useMemo(() => {
    const list = mine.data ?? [];
    if (!trimmed) return list;
    const needle = trimmed.toLowerCase();
    return list.filter(
      (nft) =>
        nft.name.toLowerCase().includes(needle) ||
        nft.concertTitle.toLowerCase().includes(needle),
    );
  }, [mine.data, trimmed]);

  const items = buying ? (market.data ?? []) : myFiltered;
  const isPending = buying ? market.isPending : mine.isPending;

  return (
    <>
      <Header title="포토카드 마켓" />

      {/* ── 고정 영역 ──
          구매/판매·검색·정렬은 **스크롤을 따라옵니다.** 카드를 한참 내려간 뒤에
          방향이나 정렬을 바꾸려고 맨 위까지 되올라가야 하면 아무도 안 바꿉니다.
          면이 불투명해야 카드가 뒤로 지나가는 게 보이지 않습니다. */}
      <div className="bg-canvas under-header sticky z-10 space-y-3 px-4 pt-4 pb-3">
        <Segmented options={SIDES} value={side} onChange={setSide} />

        {/* 검색·공연 화면의 검색창과 **같은 props** 입니다 (SearchPage 주석 참고) */}
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onClear={() => setKeyword('')}
          placeholder={buying ? '포카 이름, 공연명으로 검색' : '내 포카 검색'}
          leftIcon={<Search size={17} />}
          type="search"
          tone="contrast"
        />

        {/* 잔액·정렬을 **한 줄**에 둡니다.
            줄이 늘어날수록 카드가 아래로 밀리고, 마켓에서 보고 싶은 건 카드입니다. */}
        <div className="flex items-center justify-between gap-3">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => navigate(ROUTES.TOKEN)}
              className="hover:text-ink flex min-w-0 items-center gap-1.5 text-sm font-semibold transition-colors"
            >
              <Coins size={16} className="text-ink-muted shrink-0" />
              <span className="tabular-nums">{(token?.balance ?? 0).toLocaleString()}</span>
            </button>
          ) : (
            <span />
          )}

          {/* 정렬은 마켓에만 있습니다 — 내 카드는 몇 장뿐이라 정렬할 게 없습니다 */}
          {buying ? (
            <Select
              label="정렬"
              options={NFT_SORTS}
              value={sort}
              onChange={setSort}
              className="shrink-0"
            />
          ) : (
            <span className="text-subtle flex shrink-0 items-center gap-1.5 text-sm font-medium">
              <Images size={15} />
              <span className="tabular-nums">{myFiltered.length}</span>장
            </span>
          )}
        </div>
      </div>

      {/* ── 스크롤 영역 — 카드만 흐릅니다 ── */}
      <div className="px-4 pb-4">
        {isPending ? (
          <Loading label="포토카드를 불러오는 중" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={trimmed ? Search : Sparkles}
            title={
              trimmed
                ? '검색 결과가 없어요'
                : buying
                  ? '판매 중인 포토카드가 없어요'
                  : '보유한 포토카드가 없어요'
            }
            description={
              trimmed
                ? '다른 키워드로 찾아보세요.'
                : buying
                  ? '곧 새 카드가 올라옵니다.'
                  : '공연을 관람하면 좌석에서 포토카드가 발행돼요.'
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6">
            {items.map((nft) => (
              <li key={nft.id}>
                {/* 내 카드에는 소유자 대신 판매 상태가 뜹니다 */}
                <NftCard
                  nft={nft}
                  showOwner={buying}
                  onClick={() => navigate(ROUTES.NFT_DETAIL(nft.id))}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
