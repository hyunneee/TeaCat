import { http } from '@/shared/api';
import type { PurchaseResult } from '@/features/nft';
import type { CursorPage } from '@/shared/types';
import type { AuctionSort } from '../model/auction.model';
import type {
  AuctionBid,
  AuctionCreated,
  AuctionDetail,
  AuctionStatus,
  AuctionSummary,
  BidResult,
  MyBid,
} from '../model/auction.types';

interface PageParams {
  cursor?: string;
  size?: number;
}
/**
 * 서버 `NftAuctionController` 경로 그대로. 베이스 `/api` 는 http 가 붙입니다.
 * 응답이 목업인지 실서버인지 이 파일은 모릅니다.
 */
export const auctionApi = {
  /** 진행 중 경매 목록. 마감이 지난 건 서버가 빼고 줍니다 */
  list: (params: PageParams & { performanceId?: number; keyword?: string; sort?: AuctionSort }) =>
    http.get<CursorPage<AuctionSummary>>('/nft-market/auctions', { params }),

  /**
   * 경매 상세.
   * 로그인 상태로 부르면 `viewer` 가 채워집니다.
   * ⚠️ 이 GET 은 **만료된 경매를 닫습니다** — 마감 직후에도 확정된 결과를 돌려줍니다.
   */
  detail: (auctionId: number) => http.get<AuctionDetail>(`/auctions/${auctionId}`),

  bids: (auctionId: number, params: PageParams) =>
    http.get<CursorPage<AuctionBid>>(`/auctions/${auctionId}/bids`, { params }),

  /** 경매 등록. 포카 한 장은 고정가와 경매 중 하나에만 올라갑니다 */
  create: (
    photocardId: number,
    body: { startPrice: number; buyNowPrice?: number; durationHours: number },
  ) => http.post<AuctionCreated>(`/photocards/${photocardId}/auction`, body),

  /** 판매자 취소. 입찰이 하나라도 있으면 서버가 거절합니다 */
  cancel: (auctionId: number) => http.delete<void>(`/auctions/${auctionId}`),

  /**
   * 입찰.
   * 멱등키가 없습니다 — 같은 요청이 두 번 가면 두 번째는 `ALREADY_TOP_BIDDER` 로
   * 거절되고 돈이 두 번 묶이지 않습니다. 화면은 그 코드를 성공으로 취급합니다.
   */
  bid: (auctionId: number, amount: number) =>
    http.post<BidResult>(`/auctions/${auctionId}/bids`, { amount }),

  /** 즉시구매. `Idempotency-Key`(UUID) 필수 — 부르는 쪽이 만들어 넘깁니다 */
  buyNow: (auctionId: number, idempotencyKey: string) =>
    http.post<PurchaseResult>(
      `/auctions/${auctionId}/buy-now`,
      undefined,
      { idempotencyKey },
    ),

  myAuctions: (params: PageParams & { status?: AuctionStatus }) =>
    http.get<CursorPage<AuctionSummary>>('/users/me/auctions', { params }),

  myBids: (params: PageParams) => http.get<CursorPage<MyBid>>('/users/me/bids', { params }),
};

export const auctionKeys = {
  all: ['auction'] as const,
  list: (keyword?: string, sort?: AuctionSort, performanceId?: number) =>
    [...auctionKeys.all, 'list', keyword ?? '', sort ?? '', performanceId ?? 0] as const,
  detail: (auctionId: number) => [...auctionKeys.all, 'detail', auctionId] as const,
  bids: (auctionId: number) => [...auctionKeys.all, 'bids', auctionId] as const,
  mine: (status?: AuctionStatus) => [...auctionKeys.all, 'mine', status ?? ''] as const,
  myBids: () => [...auctionKeys.all, 'my-bids'] as const,
};
