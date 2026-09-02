import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { EmptyState, Loading } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { NftCard, useMyNfts } from '@/features/nft';

export function MyNftsPage() {
  const navigate = useNavigate();
  const { data: nfts, isPending } = useMyNfts();

  return (
    <>
      <Header title="내 포토카드" showBack />

      <div className="p-4">
        {isPending ? (
          <Loading label="포토카드를 불러오는 중" />
        ) : !nfts || nfts.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="보유한 포토카드가 없어요"
            description="공연을 관람하면 좌석별 포토카드가 발행됩니다."
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {nfts.map((nft) => (
              <li key={nft.id}>
                <NftCard
                  nft={nft}
                  showOwner={false}
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
