import { http } from '@/shared/api';
import type { AdminCatMoneyAdjustResult, AdminCatMoneyBalance } from '../model/adminCatMoney.types';

/**
 * 관리자 캣머니 조정 API (Model 레이어) — <b>테스트용</b>입니다.
 *
 * 🔴 서버에서 ADMIN 전용입니다 (`/admin/**`). 화면은 `can.manageUsers` 로 먼저 막으세요.
 *
 * 넣기와 빼기가 <b>다른 경로</b>인 이유는, 금액의 부호로 방향을 주면 -1000 을 1000 으로
 * 잘못 읽는 실수가 조용히 돈을 넣어버리기 때문입니다.
 */
export const adminCatMoneyApi = {
  /** 회원의 캣머니 잔액. available 이 차감의 상한입니다 */
  balance: (userId: number) =>
    http.get<AdminCatMoneyBalance>(`/admin/users/${userId}/catmoney`),

  /** 지급 — 요청한 금액이 그대로 발행됩니다 */
  grant: (userId: number, amount: number) =>
    http.post<AdminCatMoneyAdjustResult>(`/admin/users/${userId}/catmoney/grant`, { amount }),

  /**
   * 차감 — <b>가용 잔액보다 많이 요청하면 가용 잔액만큼만 깎입니다.</b>
   * 실제로 빠진 금액은 응답의 `appliedAmount` 를 보세요.
   */
  burn: (userId: number, amount: number) =>
    http.post<AdminCatMoneyAdjustResult>(`/admin/users/${userId}/catmoney/burn`, { amount }),
};

export const adminCatMoneyKeys = {
  all: ['admin', 'catmoney'] as const,
  balance: (userId: number) => [...adminCatMoneyKeys.all, 'balance', userId] as const,
};
