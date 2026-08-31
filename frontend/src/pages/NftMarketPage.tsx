import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Grape, Images, Search, Sparkles } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Input } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useAuth } from '@/features/auth';
import {
  DEFAULT_SORT,
  NFT_SORTS,
  NftCard,
  useMyNfts,
  useNftMarket,
  useTokenBalance,
  type NftSort,
} from '@/features/nft';

/**
 * 포토카드 마켓.
 *
 * ── 화면 순서 ─────────────────────────────────────────────
 *   검색 → 내 잔액·컬렉션 줄 → 정렬 → 2열 그리드
 *
 * 등급(NORMAL/RARE/SPECIAL)은 없습니다. 카드의 가치는 등급표가 아니라
 * **어떤 공연의 어떤 순간인지**와 가격으로 정해집니다.
 */
export function NftMarketPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<NftSort>(DEFAULT_SORT);
  const { isLoggedIn } = useAuth();

  const { data: nfts, isPending } = useNftMarket(keyword.trim() || undefined, sort);
  const { data: token } = useTokenBalance();
  // 내 포카 개수를 버튼에 띄우기 위해 목록을 미리 받아둡니다 (로그인 상태에서만).
  const { data: myNfts } = useMyNfts();

  return (
    <>
      <Header title="포토카드 마켓" />

      {/* ── 고정 영역 ──
          검색과 정렬은 **스크롤을 따라옵니다.** 카드를 한참 내려간 뒤에
          정렬을 바꾸려고 맨 위까지 되올라가야 하면 아무도 안 바꿉니다.
          면이 불투명해야 카드가 뒤로 지나가는 게 보이지 않습니다. */}
      <div className="bg-canvas under-header sticky z-10 space-y-3 px-4 pb-3">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="포카 이름, 공연명으로 검색"
          leftIcon={<Search size={17} />}
          type="search"
          tone="contrast"
        />

        {/* 잔액·내 컬렉션·정렬을 **한 줄**에 둡니다.
            줄이 늘어날수록 카드가 아래로 밀리고, 마켓에서 보고 싶은 건 카드입니다. */}
        <div className="flex items-center justify-between gap-3">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => navigate(ROUTES.MY_NFTS)}
              className="hover:text-ink flex min-w-0 items-center gap-1.5 text-sm font-semibold transition-colors"
            >
              <Grape size={16} className="text-ink-muted shrink-0" />
              <span className="tabular-nums">{(token?.balance ?? 0).toLocaleString()}</span>
              <span className="text-subtle font-medium">·</span>
              <Images size={15} className="text-ink-muted shrink-0" />
              <span className="tabular-nums">{myNfts?.length ?? 0}</span>
            </button>
          ) : (
            <span />
          )}

          <label className="text-ink-muted relative flex shrink-0 items-center text-sm font-medium">
            <span className="sr-only">정렬</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as NftSort)}
              className="cursor-pointer appearance-none bg-transparent pr-5 text-right outline-none"
            >
              {NFT_SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-0" />
          </label>
        </div>
      </div>

      {/* ── 스크롤 영역 — 카드만 흐릅니다 ── */}
      <div className="px-4 pb-4">
        {isPending ? (
          <Loading label="포토카드를 불러오는 중" />
        ) : !nfts || nfts.length === 0 ? (
          <EmptyState
            icon={keyword ? Search : Sparkles}
            title={keyword ? '검색 결과가 없어요' : '판매 중인 포토카드가 없어요'}
            description={keyword ? '다른 키워드로 찾아보세요.' : '곧 새 카드가 올라옵니다.'}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6">
            {nfts.map((nft) => (
              <li key={nft.id}>
                <NftCard nft={nft} onClick={() => navigate(ROUTES.NFT_DETAIL(nft.id))} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
