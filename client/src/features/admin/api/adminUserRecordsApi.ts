import { http } from '@/shared/api';
import type { CursorPage } from '@/shared/types';
import type { Ticket } from '@/features/ticket';
import type { MyPhotocard, PurchaseHistory, SaleHistory } from '@/features/nft';

/**
 * 회원 상세의 기록 탭 (Model 레이어).
 *
 * 🔴 서버가 <b>본인 조회와 같은 서비스</b>를 부르므로 응답 모양이 `/users/me/*` 와 같습니다.
 *    그래서 타입도 `features/ticket` · `features/nft` 의 것을 **그대로 씁니다** — 여기서
 *    따로 선언하면 한쪽만 고쳐져 화면이 갈라집니다.
 *
 * 🔴 전부 ADMIN 전용입니다 (`/admin/**`). 화면은 `can.manageUsers` 로 먼저 막으세요.
 */

/** 커서 페이지 요청 — 목록 API 셋이 같은 모양입니다 */
export interface RecordPageParams {
  cursor?: string;
  size?: number;
}

export const adminUserRecordsApi = {
  /** 예매 목록. 취소된 예매도 함께 옵니다 — 관리자는 "취소했다" 도 봐야 합니다 */
  tickets: (userId: number) => http.get<Ticket[]>(`/admin/users/${userId}/tickets`),

  /** 지금 보유한 포카. 판매 등록 중인 것도 아직 본인 소유라 함께 옵니다 */
  photocards: (userId: number, params: RecordPageParams) =>
    http.get<CursorPage<MyPhotocard>>(`/admin/users/${userId}/photocards`, { params }),

  /** 구매자로 체결한 거래. 보유 목록과 다릅니다 — 샀다가 되판 카드도 남습니다 */
  purchases: (userId: number, params: RecordPageParams) =>
    http.get<CursorPage<PurchaseHistory>>(`/admin/users/${userId}/photocards/purchases`, {
      params,
    }),

  /** 판매자로 체결한 거래 */
  sales: (userId: number, params: RecordPageParams) =>
    http.get<CursorPage<SaleHistory>>(`/admin/users/${userId}/photocards/sales`, { params }),
};

/** 회원마다 따로 캐시됩니다 — userId 가 키에 없으면 다른 회원의 목록이 보입니다 */
export const adminUserRecordKeys = {
  all: ['admin', 'userRecords'] as const,
  ofUser: (userId: number) => [...adminUserRecordKeys.all, userId] as const,
  tickets: (userId: number) => [...adminUserRecordKeys.ofUser(userId), 'tickets'] as const,
  photocards: (userId: number) => [...adminUserRecordKeys.ofUser(userId), 'photocards'] as const,
  purchases: (userId: number) => [...adminUserRecordKeys.ofUser(userId), 'purchases'] as const,
  sales: (userId: number) => [...adminUserRecordKeys.ofUser(userId), 'sales'] as const,
};
