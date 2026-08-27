import { env } from '@/shared/config';
import type {
  PayMethod,
  PaymentAuthResult,
  PaymentFailure,
  PaymentPrepareResponse,
} from '../model/payment.types';
import { toPaymentFailure } from '../model/payment.model';

/**
 * 결제 게이트웨이 어댑터 (포트원 V2 + 토스페이먼츠 채널).
 *
 * ── 이 파일이 존재하는 이유 ────────────────────────────────
 * PG SDK 호출을 여기 한 곳에 격리합니다. 그래야
 *   - PG 를 바꿔도 (토스 → 나이스 등) 이 파일만 고치면 되고
 *   - 실제 결제 없이도 전체 플로우를 돌릴 수 있고 (mock 모드)
 *   - 훅·화면은 "결제창 띄우고 결과 받기" 라는 개념만 알면 됩니다
 *
 * ── 지금 상태 ──────────────────────────────────────────────
 * `VITE_PAYMENT_MODE=mock` 이 기본입니다. 결제창을 띄우지 않고
 * 모의 인증 결과를 만들어 백엔드 승인 단계로 넘깁니다.
 * 포트원 계정이 준비되면 `.env` 를 `portone` 으로 바꾸고
 * storeId / channelKey 를 채우면 코드 수정 없이 실제 결제창이 뜹니다.
 *
 * ── 승인은 프론트가 하지 않습니다 ──────────────────────────
 * 여기서 얻는 건 **인증(authentication)** 까지입니다.
 * 실제 승인(검증)은 백엔드가 포트원 서버 API 로 결제를 조회해
 * 금액·상태를 확인한 뒤 처리합니다. (paymentApi.confirm)
 */

export type GatewayResult =
  | { ok: true; auth: PaymentAuthResult }
  | { ok: false; failure: PaymentFailure };

/** 포트원 payMethod 로 변환. 화면 코드가 PG 값을 직접 알지 않게 합니다. */
const PORTONE_PAY_METHOD: Record<PayMethod, string> = {
  CARD: 'CARD',
  EASY_PAY: 'EASY_PAY',
  TRANSFER: 'TRANSFER',
  VIRTUAL_ACCOUNT: 'VIRTUAL_ACCOUNT',
};

export interface RequestPaymentParams {
  prepared: PaymentPrepareResponse;
  payMethod: PayMethod;
  /**
   * 모바일에서는 결제창이 새 페이지로 이동합니다.
   * 인증이 끝나면 이 주소로 쿼리 파라미터(paymentId, code, message)와 함께 돌아옵니다.
   */
  redirectUrl: string;
}

/** 실제 포트원 결제창 호출 */
async function requestViaPortOne({
  prepared,
  payMethod,
  redirectUrl,
}: RequestPaymentParams): Promise<GatewayResult> {
  if (!env.payment.storeId || !env.payment.channelKey) {
    return {
      ok: false,
      failure: {
        code: 'CONFIG_MISSING',
        message: '결제 설정이 없습니다. VITE_PORTONE_STORE_ID / CHANNEL_KEY 를 확인해 주세요.',
        canceledByUser: false,
      },
    };
  }

  // SDK 는 실제로 쓸 때만 내려받습니다. mock 모드 번들에는 들어가지 않습니다.
  const PortOne = await import('@portone/browser-sdk/v2');

  const response = await PortOne.requestPayment({
    storeId: env.payment.storeId,
    channelKey: env.payment.channelKey,
    paymentId: prepared.paymentId,
    orderName: prepared.orderName,
    totalAmount: prepared.totalAmount,
    currency: 'CURRENCY_KRW',
    payMethod: PORTONE_PAY_METHOD[payMethod] as 'CARD',
    customer: {
      customerId: prepared.customer.customerId,
      fullName: prepared.customer.fullName,
      phoneNumber: prepared.customer.phoneNumber,
      email: prepared.customer.email,
    },
    redirectUrl,
  });

  // 리디렉션 방식으로 진행된 경우 여기로 돌아오지 않고 페이지가 이동합니다.
  if (!response) {
    return {
      ok: false,
      failure: { code: 'REDIRECTED', message: '결제창으로 이동합니다.', canceledByUser: false },
    };
  }

  if (response.code != null) {
    return { ok: false, failure: toPaymentFailure(response.code, response.message) };
  }

  return { ok: true, auth: { paymentId: response.paymentId, txId: response.txId } };
}

/**
 * 모의 결제.
 *
 * 결제창 대신 확인 창을 띄웁니다. "취소"를 누르면 실제 결제 취소와
 * 똑같은 경로를 타므로, 취소 처리도 함께 테스트할 수 있습니다.
 */
async function requestViaMock({ prepared }: RequestPaymentParams): Promise<GatewayResult> {
  const approved = window.confirm(
    `[모의 결제]\n\n${prepared.orderName}\n${prepared.totalAmount.toLocaleString()}원\n\n확인을 누르면 결제가 승인됩니다.`,
  );

  if (!approved) {
    return {
      ok: false,
      failure: {
        code: 'PAY_PROCESS_CANCELED',
        message: '결제를 취소했습니다.',
        canceledByUser: true,
      },
    };
  }

  // 실제 결제창처럼 약간의 지연을 둡니다 (로딩 UI 확인용)
  await new Promise((resolve) => setTimeout(resolve, 600));

  return {
    ok: true,
    auth: { paymentId: prepared.paymentId, txId: `mock-tx-${crypto.randomUUID()}` },
  };
}

/** 결제창을 띄우고 인증 결과를 돌려줍니다. 승인은 백엔드가 합니다. */
export function requestPayment(params: RequestPaymentParams): Promise<GatewayResult> {
  return env.payment.mode === 'portone' ? requestViaPortOne(params) : requestViaMock(params);
}

/**
 * 모바일 리디렉션으로 돌아왔을 때 쿼리에서 결과를 읽습니다.
 * 성공이면 auth, 실패면 failure, 결제와 무관한 진입이면 null.
 */
export function readRedirectResult(search: string): GatewayResult | null {
  const params = new URLSearchParams(search);
  const paymentId = params.get('paymentId');
  if (!paymentId) return null;

  const code = params.get('code');
  if (code) {
    return { ok: false, failure: toPaymentFailure(code, params.get('message') ?? undefined) };
  }

  return { ok: true, auth: { paymentId, txId: params.get('txId') ?? '' } };
}
