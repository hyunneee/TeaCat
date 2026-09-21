/**
 * 서버 `NftAuctionController` 응답과 1:1 입니다. **필드 이름을 바꾸지 마세요.**
 *
 * 시각은 서버가 타임존 없는 KST 문자열("2026-09-09T21:00:00")로 줍니다 —
 * 카운트다운을 계산할 때는 반드시 `parseServerTime`(shared/lib)을 거치세요.
 * 금액(CAT)은 정수입니다.
 *
 * `null` 과 생략을 둘 다 받습니다. 서버 봉투의 `NON_NULL` 은 `BaseResponse` 에만
 * 걸려 있어 안쪽 필드는 `null` 로 내려옵니다.
 */

export type AuctionStatus = 'ACTIVE' | 'SETTLING' | 'SOLD' | 'EXPIRED' | 'CANCELLED';

/** 내가 입찰한 경매 한 건의 내 관점 결과 */
export type MyBidResult = 'BIDDING' | 'OUTBID' | 'SETTLING' | 'WON' | 'LOST';

/** 경매 목록 항목 (`GET /nft-market/auctions`, `GET /users/me/auctions`) */
export interface AuctionSummary {
  auctionId: number;
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  performanceTitle: string;
  sellerNickname: string;
  startPrice: number;
  currentPrice: number;
  /** 없으면 즉시구매가 불가능한 경매 */
  buyNowPrice?: number | null;
  bidCount: number;
  endsAt: string;
  status: AuctionStatus;
  /** 내 경매 목록에서만 의미가 있습니다 */
  closedAt?: string | null;
  winnerNickname?: string | null;
}

/** 경매 상세 (`GET /auctions/{id}`) */
export interface AuctionDetail {
  auctionId: number;
  status: AuctionStatus;
  photocard: {
    photocardId: number;
    designName: string;
    imageUrl: string | null;
    performanceTitle: string;
  };
  sellerNickname: string;
  startPrice: number;
  currentPrice: number;
  buyNowPrice?: number | null;
  bidCount: number;
  topBidderNickname?: string | null;
  createdAt: string;
  endsAt: string;
  closedAt?: string | null;
  /** 종료된 뒤에만 채워집니다 */
  winnerNickname?: string | null;
  finalPrice?: number | null;
  /** 토큰을 보낸 요청에만 옵니다. 비로그인이면 없습니다 */
  viewer?: {
    isSeller: boolean;
    isTopBidder: boolean;
    myHighestBid?: number | null;
  } | null;
}

/** 입찰 이력 한 줄 (`GET /auctions/{id}/bids`) */
export interface AuctionBid {
  bidId: number;
  bidderNickname: string;
  amount: number;
  bidAt: string;
}

/** 입찰 성공 응답 (`POST /auctions/{id}/bids`) */
export interface BidResult {
  bidId: number;
  auctionId: number;
  amount: number;
  currentPrice: number;
  bidCount: number;
  endsAt: string;
  isTopBidder: boolean;
}

/** 경매 등록 응답 (`POST /photocards/{id}/auction`) */
export interface AuctionCreated {
  auctionId: number;
  photocardId: number;
  status: AuctionStatus;
  startPrice: number;
  buyNowPrice?: number | null;
  currentPrice: number;
  endsAt: string;
  createdAt: string;
}

/** 내가 입찰한 경매 한 줄 (`GET /users/me/bids`). 여러 번 입찰해도 경매당 한 줄입니다 */
export interface MyBid {
  auctionId: number;
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  myHighestBid: number;
  currentPrice: number;
  isTopBidder: boolean;
  status: AuctionStatus;
  endsAt: string;
  result: MyBidResult;
  lastBidAt: string;
}
