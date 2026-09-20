import { useModal } from '@/app/providers';
import { useParams } from 'react-router-dom';
import { DetailHeader as Header } from '@/shared/components/layout';
import { EmptyState } from '@/shared/components/common';
import { AuctionTradePanel, useAuctionTrade } from '@/features/auction';
import { PhotocardDetailLayout, PocaShowcase, pocaSeed } from '@/features/nft';

export function AuctionDetailPage() {
  const { open } = useModal();
  const { auctionId: raw = '' } = useParams();
  const id = Number(raw);
  const trade = useAuctionTrade(id);
  const card = trade.auction?.photocard;
  return (
    <>
      <Header title="경매" showBack />
      {!Number.isInteger(id) || id <= 0 ? (
        <EmptyState title="없는 경매예요" />
      ) : (
        <PhotocardDetailLayout
          image={
            card && (
              <PocaShowcase
                className="mx-auto w-48 lg:w-full lg:max-w-72"
                seed={pocaSeed(card.photocardId)}
                imageUrl={card.imageUrl}
                alt={`${card.designName} 포토카드`}
              />
            )
          }
        >
          <AuctionTradePanel
            onBid={(props) => open('auction/bid', props)}
            onConfirm={(props) => open('common/confirm', props)}
            trade={trade}
          />
        </PhotocardDetailLayout>
      )}
    </>
  );
}
