/**
 * 포토카드 경매.
 *
 * 포카(`features/nft`)와 나란히 둡니다. 서버는 경매를 nft 도메인 안에 두었지만,
 * 클라이언트에서는 화면 넷과 엔드포인트 열하나가 더 붙으므로 파일을 나눕니다.
 * 카드 그림(`PocaArt`·`pocaSeed`)만 포카 배럴에서 빌려 씁니다.
 */
export { useAuctions } from './hooks/useAuction';
export { AuctionCard } from './components/AuctionCard';
export { AuctionCountdown } from './components/AuctionCountdown';
export { auctionApi, auctionKeys } from './api/auctionApi';
export {
  AUCTION_SORTS,
  DEFAULT_AUCTION_SORT,
  DURATION_OPTIONS,
  DEFAULT_DURATION_HOURS,
  MY_BID_RESULT,
  msUntilEnd,
  isRunning,
  formatTimeLeft,
  bidRange,
  canBid,
  canBuyNow,
  canCancel,
  auctionResultText,
  type AuctionSort,
} from './model/auction.model';
export type {
  AuctionStatus,
  MyBidResult,
  AuctionSummary,
  AuctionDetail,
  AuctionBid,
  BidResult,
  AuctionCreated,
  MyBid,
} from './model/auction.types';
