export type RankTrend = 'UP' | 'DOWN' | 'SAME' | 'NEW';

export interface PopularConcert {
  rank: number;
  previousRank: number | null;
  trend: RankTrend;
  score: number;
  concertId: number;
  title: string;
  stadiumName: string;
  posterUrl: string | null;
}

export interface PopularPhotocard {
  rank: number;
  previousRank: number | null;
  trend: RankTrend;
  tradeCount: number;
  tradedAmount: number;
  designId: number;
  designName: string;
  imageUrl: string;
  performanceTitle: string | null;
  photocardId: number;
  auctionId: number | null;
  marketType: 'FIXED' | 'AUCTION';
}
