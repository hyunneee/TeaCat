import { http, newIdempotencyKey } from '@/shared/api';
import type { PaymentConfirmResponse, PaymentPrepareResponse } from '../model/payment.types';

export const paymentApi = {
  /** 선점한 좌석으로 서버 주문을 생성하고 결제 금액을 확정합니다. */
  prepare: (body: { performanceDetailId: number; seatId: number }) =>
    http.post<PaymentPrepareResponse>('/payments/ticket-orders', body),

  /** 토스 인증 결과를 승인하거나 전액 캣머니 주문을 바로 확정합니다. */
  confirm: (
    body: {
      ticketOrderId: number;
      paymentKey?: string;
      amount?: number;
    },
    idempotencyKey: string,
  ) =>
    http.post<PaymentConfirmResponse>('/payments/ticket-orders/confirm', body, {
      idempotencyKey,
    }),

  /**
   * 주문 한 건. 결제 금액이 여기 있습니다 — 티켓 응답에는 금액이 없고
   * `ticketOrderId` 만 들어 있습니다 (서버 `MyTicketResponse` 주석).
   */
  order: (ticketOrderId: number) =>
    http.get<PaymentConfirmResponse>(`/payments/ticket-orders/${ticketOrderId}`),

  /**
   * 예매 취소. 카드 취소·캣머니 환급·NFT 소각까지 **서버가 이어서** 합니다.
   * 프론트는 결과를 기다리지 않고, 환불이 밀리면 서버 배치가 따라갑니다.
   */
  cancel: (ticketOrderId: number) =>
    http.post<PaymentConfirmResponse>(
      `/payments/ticket-orders/${ticketOrderId}/cancel`,
      undefined,
      { idempotencyKey: newIdempotencyKey() },
    ),
};

export const paymentKeys = {
  all: ['payment'] as const,
  order: (ticketOrderId: number) => [...paymentKeys.all, 'order', ticketOrderId] as const,
};
