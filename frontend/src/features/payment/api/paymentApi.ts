import { http } from '@/shared/api';
import type {
  PaymentConfirmResponse,
  PaymentPrepareResponse,
  PayMethod,
} from '../model/payment.types';

/**
 * 우리 백엔드와 대화하는 부분. (PG SDK 호출은 paymentGateway.ts)
 *
 * 결제는 반드시 서버를 두 번 거칩니다.
 *   1) prepare — 서버가 주문을 만들고 **금액과 paymentId 를 확정**
 *   2) confirm — 서버가 포트원 API 로 결제를 조회해 금액·상태를 검증하고 승인
 *
 * 프론트가 금액을 계산해 결제창에 넣고 그대로 믿으면,
 * 요청을 조작해 1원 결제를 만들 수 있습니다. 금액의 출처는 항상 서버입니다.
 */
export const paymentApi = {
  /** 선점한 좌석으로 결제할 주문을 준비합니다. */
  prepare: (body: { holdId: string; recipients: { seatId: string; loginId: string }[] }) =>
    http.post<PaymentPrepareResponse>('/payments/prepare', body),

  /**
   * 결제창 인증까지 끝난 뒤 서버에 승인을 요청합니다.
   * 백엔드가 포트원 결제 조회 → 금액 검증 → 승인 → 티켓 발급까지 처리합니다.
   *
   * 멱등키를 붙여 같은 결제가 두 번 승인되지 않게 합니다.
   */
  confirm: (
    body: { paymentId: string; txId: string; payMethod: PayMethod },
    idempotencyKey: string,
  ) => http.post<PaymentConfirmResponse>('/payments/confirm', body, { idempotencyKey }),
};

export const paymentKeys = {
  all: ['payment'] as const,
};
