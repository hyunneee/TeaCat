/** 화면에서 고르는 결제수단 */
export type PayMethod = 'CARD' | 'EASY_PAY' | 'TRANSFER' | 'VIRTUAL_ACCOUNT';

/**
 * 결제 준비 응답.
 *
 * **금액과 결제 ID 는 서버가 정합니다.** 프론트가 계산한 금액을 그대로 결제하면
 * 사용자가 요청을 조작해 1원 결제를 만들 수 있습니다.
 * 프론트는 서버가 준 값을 결제창에 그대로 전달만 합니다.
 */
export interface PaymentPrepareResponse {
  /** 포트원에 넘길 고객사 주문 고유 ID */
  paymentId: string;
  orderName: string;
  /** 원 단위 정수 */
  totalAmount: number;
  currency: 'KRW';
  customer: {
    customerId: string;
    fullName: string;
    phoneNumber: string;
    email: string;
  };
}

/** 결제창 인증까지 성공했을 때 받는 값 */
export interface PaymentAuthResult {
  paymentId: string;
  /** 결제 시도 ID (포트원이 발급) */
  txId: string;
}

/** 백엔드 승인(검증) 결과 */
export interface PaymentConfirmResponse {
  orderId: string;
  ticketIds: string[];
  totalPrice: number;
  paidAt: string;
}

/** 결제창에서 돌아온 실패 사유 */
export interface PaymentFailure {
  code: string;
  message: string;
  /** 사용자가 직접 닫은 경우 — 에러 토스트를 띄우지 않습니다 */
  canceledByUser: boolean;
}
