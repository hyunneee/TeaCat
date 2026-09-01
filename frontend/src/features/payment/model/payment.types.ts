/**
 * 화면에서 고르는 결제수단.
 *
 *  EASY_PAY — 토스 간편결제. 결제창(PG)을 거칩니다.
 *  POINT    — 앱 안의 캣머니(포인트). PG 를 타지 않고 **서버가 잔액을 차감**합니다.
 *
 * 수단을 늘리려면 계약된 결제수단인지 먼저 확인하세요.
 */
export type PayMethod = 'EASY_PAY' | 'POINT';

/** PG 결제창을 거치는 수단 (판정은 payment.model.ts 의 usesGateway) */
export type GatewayPayMethod = Exclude<PayMethod, 'POINT'>;

/**
 * 결제 준비 응답.
 *
 * **금액과 주문 ID 는 서버가 정합니다.** 프론트가 계산한 금액을 그대로 결제하면
 * 사용자가 요청을 조작해 1원 결제를 만들 수 있습니다.
 * 프론트는 서버가 준 값을 결제창에 그대로 전달만 합니다.
 */
export interface PaymentPrepareResponse {
  /**
   * 토스에 넘길 주문 고유 ID (`orderId`).
   * 토스 규격: **6~64자, 영문·숫자·`-`·`_` 만** 허용합니다.
   */
  paymentId: string;
  orderName: string;
  /** 원 단위 정수 */
  totalAmount: number;
  currency: 'KRW';
  /** 캣머니로 결제할 때 차감될 개수. 이것도 **서버가 계산**합니다. */
  pointAmount: number;
  /** 결제 시점의 캣머니 잔액 */
  pointBalance: number;
  customer: {
    customerId: string;
    fullName: string;
    phoneNumber: string;
    email: string;
  };
}

/** 결제창 인증까지 성공했을 때 받는 값 */
export interface PaymentAuthResult {
  /** 우리가 만든 주문 ID (토스의 `orderId`) */
  paymentId: string;
  /**
   * 토스가 발급한 결제 키. 승인 API 에 이 값이 필요합니다.
   * 캣머니 결제는 PG 를 타지 않으므로 비어 있습니다.
   */
  paymentKey: string;
  /**
   * 결제창이 알려준 금액.
   * ⚠️ 주소창에서 온 값이라 조작될 수 있습니다. 백엔드가 자기 금액과 비교해야 합니다.
   */
  amount: number;
}

/** 백엔드 승인(검증) 결과 */
export interface PaymentConfirmResponse {
  orderId: string;
  ticketIds: string[];
  totalPrice: number;
  paidAt: string;
  /** 캣머니로 결제했다면 차감 후 잔액 */
  pointBalance?: number;
}

/** 결제창에서 돌아온 실패 사유 */
export interface PaymentFailure {
  code: string;
  message: string;
  /** 사용자가 직접 닫은 경우 — 에러 토스트를 띄우지 않습니다 */
  canceledByUser: boolean;
}
