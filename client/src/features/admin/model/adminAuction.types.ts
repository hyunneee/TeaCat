/**
 * 어드민 경매 관리 타입 — 서버 `/admin/nft/auctions` 응답 그대로.
 *
 * 🔴 사용자용 `features/auction` 의 타입을 재사용하지 않습니다. 저쪽에는 판매자·낙찰자
 * 닉네임과 취소 가능 여부가 없고, 저쪽 타입을 늘리면 사용자 화면이 안 쓰는 운영 정보가
 * 사용자 응답 타입에 섞입니다.
 */

/** DB `nft_auction_status` 와 1:1 */
export type AdminAuctionStatus = 'ACTIVE' | 'SETTLING' | 'SOLD' | 'EXPIRED' | 'CANCELLED';

export interface AdminAuction {
  auctionId: number;
  photocardId: number;
  designName: string;
  imageUrl: string | null;
  /** 뽑기 카드는 null */
  performanceTitle: string | null;
  sellerNickname: string;
  /** 낙찰·정산 중이 아니면 null */
  winnerNickname: string | null;
  status: AdminAuctionStatus;
  startPrice: number;
  currentPrice: number;
  buyNowPrice: number | null;
  bidCount: number;
  endsAt: string;
  createdAt: string;
  /** 진행 중이면 null */
  closedAt: string | null;
  /**
   * 🔴 **서버가 판정한 값입니다.** 화면에서 `status === 'ACTIVE' && endsAt > now` 를 다시
   * 계산하지 마세요 — 어드민 브라우저 시계가 서버와 다르면 눌렀을 때 실패하는 버튼이 됩니다.
   */
  cancellable: boolean;
}

export interface AdminAuctionBid {
  bidId: number;
  bidderNickname: string;
  amount: number;
  bidAt: string;
}

export interface AdminAuctionDetail {
  auction: AdminAuction;
  /** 회원 상세로 이어 보기 위한 값 */
  sellerId: number;
  /** 입찰이 없으면 null */
  topBidderId: number | null;
  topBidderNickname: string | null;
  /** 최근 입찰부터. 서버가 상한(200건)을 둡니다 */
  bids: AdminAuctionBid[];
}

export interface AdminAuctionPage {
  auctions: AdminAuction[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminAuctionQuery {
  /** 비우면 전체 */
  status?: AdminAuctionStatus;
  /** 도안명·공연명·판매자 닉네임 */
  keyword?: string;
  page: number;
  size: number;
}
