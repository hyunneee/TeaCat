import { http } from '@/shared/api';
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

};

export const paymentKeys = {
  all: ['payment'] as const,
};
