import type { ConcertSummary } from '@/features/concert';
import type { MarketPhotocard } from '@/features/nft';

export interface UnifiedSearchResult {
  keyword: string;
  concerts: ConcertSummary[];
  photocards: MarketPhotocard[];
}
