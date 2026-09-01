import { http } from '@/shared/api';
import type {
  PaymentConfirmResponse,
  PaymentPrepareResponse,
  PayMethod,
} from '../model/payment.types';

/**
 * 우리 백엔드와 대화하는 부분. (토스 SDK 호출은 paymentGateway.ts)
 *
 * 결제는 반드시 서버를 두 번 거칩니다.
 *   1) prepare — 서버가 주문을 만들고 **금액과 orderId 를 확정**
 *   2) confirm — 서버가 토스 승인 API 를 호출해 결제를 확정
 *
 * 백엔드가 confirm 에서 해야 하는 일:
 *   POST https://api.tosspayments.com/v1/payments/confirm
 *   Authorization: Basic base64(SECRET_KEY + ':')
 *   { paymentKey, orderId, amount }
 *
 * ⚠️ 프론트가 보낸 amount 를 그대로 넘기면 안 됩니다.
 *    주소창에서 온 값이라 조작될 수 있습니다.
 *    서버가 prepare 때 저장한 금액과 비교한 뒤, **저장된 금액**으로 승인해야 합니다.
 *    금액이 다르면 승인하지 말고 실패로 처리합니다.
 *
 * 캣머니(POINT) 결제는 PG 를 거치지 않습니다. confirm 에서 서버가
 * 잔액을 확인하고 **서버가 계산한 캣머니**을 차감한 뒤 티켓을 발급합니다.
 * 프론트가 보낸 차감량을 믿으면 공짜 티켓이 나옵니다.
 */
export const paymentApi = {
  /** 선점한 좌석으로 결제할 주문을 준비합니다. */
  prepare: (body: { holdId: string; recipients: { seatId: string; loginId: string }[] }) =>
    http.post<PaymentPrepareResponse>('/payments/prepare', body),

  /**
   * 결제창 인증까지 끝난 뒤 서버에 승인을 요청합니다.
   * 멱등키를 붙여 같은 결제가 두 번 승인되지 않게 합니다.
   */
  confirm: (
    body: {
      paymentId: string;
      /** 캣머니 결제는 PG 를 타지 않아 비어 있습니다. */
      paymentKey: string;
      amount: number;
      payMethod: PayMethod;
    },
    idempotencyKey: string,
  ) => http.post<PaymentConfirmResponse>('/payments/confirm', body, { idempotencyKey }),
};

export const paymentKeys = {
  all: ['payment'] as const,
};
