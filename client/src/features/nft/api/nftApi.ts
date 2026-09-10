import { http } from '@/shared/api';
import type { CursorPage } from '@/shared/types';
import type { NftSort } from '../model/nft.model';
import type {
  MarketPhotocard,
  MyPhotocard,
  PhotocardDetail,
  PhotocardListing,
  PhotocardTradeHistory,
  PocaDrawResult,
  PurchaseHistory,
  PurchaseResult,
  SaleHistory,
} from '../model/nft.types';

interface PageParams {
  cursor?: string;
  size?: number;
}

/**
 * 서버 `NftController` 경로 그대로. 베이스 `/api` 는 http 가 붙입니다.
 * 응답이 목업인지 실서버인지 이 파일은 모릅니다.
 */
export const nftApi = {
  /** 마켓 목록. `keyword` 는 도안명·공연명, `sort` 는 서버 정렬, 커서 페이지 */
  market: (params: PageParams & { performanceId?: number; keyword?: string; sort?: NftSort }) =>
    http.get<CursorPage<MarketPhotocard>>('/nft-market/photocards', { params }),

  detail: (photocardId: number) => http.get<PhotocardDetail>(`/photocards/${photocardId}`),

  /**
   * 포카 뽑기. **어떤 카드가 나오는지는 서버가 정합니다** — 응답을 그대로 연출합니다.
   * `Idempotency-Key` 로 재시도해도 한 장만 발행됩니다 (purchase 와 같은 규칙).
   */
  draw: (idempotencyKey: string) =>
    http.post<PocaDrawResult>('/photocards/draw', undefined, { idempotencyKey }),

  /** 내 포카. `listed` 로 판매 중만 / 보관 중만 거를 수 있다 */
  mine: (params: PageParams & { listed?: boolean }) =>
    http.get<CursorPage<MyPhotocard>>('/users/me/photocards', { params }),

  purchases: (params: PageParams) =>
    http.get<CursorPage<PurchaseHistory>>('/users/me/photocards/purchases', { params }),

  sales: (params: PageParams) =>
    http.get<CursorPage<SaleHistory>>('/users/me/photocards/sales', { params }),

  /** 포카 한 장의 거래 이력 — 화면은 아직 없다 */
  trades: (photocardId: number, params: PageParams) =>
    http.get<CursorPage<PhotocardTradeHistory>>(`/photocards/${photocardId}/trades`, { params }),

  /**
   * 구매. `Idempotency-Key` 는 **필수**(UUID). 같은 키로 재시도하면 서버가 한 번만 체결합니다.
   * 키는 호출하는 쪽(훅)이 만들어 넘깁니다 — 재시도에 같은 키를 쓰려면 밖에서 들고 있어야 합니다.
   */
  purchase: (photocardId: number, idempotencyKey: string) =>
    http.post<PurchaseResult>(`/photocards/${photocardId}/purchase`, undefined, {
      idempotencyKey,
    }),

  /**
   * 판매 등록.
   * 🔴 서버는 `description` 을 **필수**(1~500자)로 받습니다(@NotBlank).
   * 화면에서 입력칸을 뺐으므로, 백엔드가 그 제약을 풀기 전까지 실서버 등록은 400 입니다.
   */
  list: (photocardId: number, body: { price: number; description?: string }) =>
    http.post<PhotocardListing>(`/photocards/${photocardId}/listing`, body),

  unlist: (photocardId: number) => http.delete<void>(`/photocards/${photocardId}/listing`),

  /** 남은 뽑기가 있는지 — 조건은 서버가 정합니다 */
  drawAvailability: () => http.get<{ available: boolean }>('/photocards/draw'),
};

export const nftKeys = {
  all: ['nft'] as const,
  market: (keyword?: string, sort?: NftSort, performanceId?: number) =>
    [...nftKeys.all, 'market', keyword ?? '', sort ?? '', performanceId ?? 0] as const,
  detail: (photocardId: number) => [...nftKeys.all, 'detail', photocardId] as const,
  mine: () => [...nftKeys.all, 'mine'] as const,
  drawAvailability: () => [...nftKeys.all, 'draw-availability'] as const,
  purchases: () => [...nftKeys.all, 'purchases'] as const,
  sales: () => [...nftKeys.all, 'sales'] as const,
};
