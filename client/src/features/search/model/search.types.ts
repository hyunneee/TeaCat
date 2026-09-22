import type { ConcertSummary } from '@/features/concert';
import type { MarketPhotocard } from '@/features/nft';
import type { AuctionSummary } from '@/features/auction';

export interface UnifiedSearchResult {
  keyword: string;
  concerts: ConcertSummary[];
  photocards: MarketPhotocard[];
  auctions: AuctionSummary[];
}
