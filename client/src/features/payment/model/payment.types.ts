/** 사용자가 화면에서 고르는 결제 수단. */
export type PayMethod = 'EASY_PAY' | 'POINT';

/** PG 결제창을 거치는 결제 수단. */
export type GatewayPayMethod = Exclude<PayMethod, 'POINT'>;

/** 서버의 POST /payments/ticket-orders 응답. */
export interface PaymentPrepareResponse {
  /** 서버가 생성한 티켓 주문 PK. 승인·완료 조회에 사용합니다. */
  ticketOrderId: number;
  /** 토스에 넘길 주문번호. 전액 캣머니 결제면 null입니다. */
  orderId: string | null;
  orderName: string;
  /** 티켓 총액(원). */
  totalAmount: number;
  /** 서버가 확정한 캣머니 사용액. */
  tokenAmount: number;
  /** 토스로 결제할 나머지 금액. 0이면 결제창을 열지 않습니다. */
  cashAmount: number;
  /** 토스 결제 고객 식별자. 카드 결제가 없으면 null입니다. */
  customerKey: string | null;
}

/** 토스 인증 결과 또는 전액 캣머니 주문의 승인 정보. */
export interface PaymentAuthResult {
  ticketOrderId: number;
  /** 전액 캣머니 결제면 빈 문자열입니다. */
  paymentKey: string;
  /** 토스가 반환한 카드 결제 금액. 전액 캣머니 결제면 0입니다. */
  amount: number;
}

/** 서버의 POST /payments/ticket-orders/confirm 응답. */
export interface PaymentConfirmResponse {
  ticketOrderId: number;
  ticketId: number | null;
  ticketKey: string | null;
  totalAmount: number;
  tokenAmount: number;
  cashAmount: number;
  nftStatus: string | null;
  paidAt: string;
}

/** 결제창에서 돌아온 실패 사유. */
export interface PaymentFailure {
  code: string;
  message: string;
  canceledByUser: boolean;
}
