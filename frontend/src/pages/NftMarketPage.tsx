import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Search, Sparkles } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Card, Input, Segmented } from '@/shared/components/ui';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useAuth } from '@/features/auth';
import { NftCard, useMyNfts, useNftMarket, useTokenBalance } from '@/features/nft';
import type { Rarity } from '@/features/nft';

const FILTERS = [
  { value: 'ALL', label: '전체' },
  { value: 'NORMAL', label: 'NORMAL' },
  { value: 'RARE', label: 'RARE' },
  { value: 'SPECIAL', label: 'SPECIAL' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

export function NftMarketPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [keyword, setKeyword] = useState('');
  const { isLoggedIn } = useAuth();

  const { data: nfts, isPending } = useNftMarket(
    filter === 'ALL' ? undefined : (filter as Rarity),
    keyword.trim() || undefined,
  );
  const { data: token } = useTokenBalance();
  // 내 포카 개수를 버튼에 띄우기 위해 목록을 미리 받아둡니다 (로그인 상태에서만).
  const { data: myNfts } = useMyNfts();

  return (
    <>
      {/* 우상단 버튼은 두지 않습니다. 아래 잔액 카드의 "내 포카" 로 들어갑니다. */}
      <Header title="포토카드 마켓" />

      <div className="space-y-4 p-4">
        {/* 보유 포도알 + 내 포카 바로가기 */}
        {isLoggedIn && (
          <Card padded={false} className="flex items-center gap-3 p-3.5">
            <span className="bg-accent-900 text-accent-300 flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Coins size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-subtle text-xs">보유 포도알</p>
              <p className="font-bold tabular-nums">
                {(token?.balance ?? 0).toLocaleString()}
                <span className="text-subtle ml-1 text-xs font-medium">
                  {token?.symbol ?? 'GRAPE'}
                </span>
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Sparkles size={14} />}
              onClick={() => navigate(ROUTES.MY_NFTS)}
            >
              내 포카 {myNfts?.length ?? 0}장
            </Button>
          </Card>
        )}

        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="포카 이름, 공연명으로 검색"
          leftIcon={<Search size={17} />}
          type="search"
          tone="contrast"
        />

        <Segmented options={FILTERS} value={filter} onChange={setFilter} />

        {isPending ? (
          <Loading label="포토카드를 불러오는 중" />
        ) : !nfts || nfts.length === 0 ? (
          <EmptyState
            icon={keyword ? Search : Sparkles}
            title={keyword ? '검색 결과가 없어요' : '판매 중인 포토카드가 없어요'}
            description={keyword ? '다른 키워드로 찾아보세요.' : '다른 등급을 확인해 보세요.'}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
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
