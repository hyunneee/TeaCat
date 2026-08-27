import { env } from '@/shared/config';
import type {
  PayMethod,
  PaymentAuthResult,
  PaymentFailure,
  PaymentPrepareResponse,
} from '../model/payment.types';
import { toPaymentFailure } from '../model/payment.model';

/**
 * 결제 게이트웨이 어댑터 — **토스페이먼츠 결제창** 직접 연동.
 *
 * ── 이 파일이 존재하는 이유 ────────────────────────────────
 * PG SDK 호출을 여기 한 곳에 격리합니다. 그래야
 *   - PG 를 바꿔도 이 파일만 고치면 되고
 *   - 실제 결제 없이도 전체 플로우를 돌릴 수 있고 (mock 모드)
 *   - 훅·화면은 "결제창 띄우고 결과 받기" 라는 개념만 알면 됩니다
 *
 * ── 토스페이먼츠는 성공 시 "항상" 리디렉션입니다 ───────────
 * `successUrl` 을 주면 인증 성공 후 그 주소로 페이지가 이동합니다.
 * 즉 데스크톱·모바일 구분 없이 결과는 리디렉션으로만 돌아옵니다.
 * (`successUrl` 을 생략하면 Promise 로 결과를 받는 방식도 있지만,
 *  그 경우 창을 닫는 등의 이탈 처리가 브라우저마다 달라 리디렉션을 씁니다)
 *
 *   requestPayment() → [토스 결제창] → successUrl?paymentKey=..&orderId=..&amount=..
 *                                    → failUrl?code=..&message=..&orderId=..
 *
 * ── 승인은 프론트가 하지 않습니다 ──────────────────────────
 * 여기서 얻는 건 **인증(authentication)** 까지입니다.
 * 실제 승인은 백엔드가 토스 결제 승인 API 를 호출해야 완료됩니다.
 *   POST https://api.tosspayments.com/v1/payments/confirm
 *   { paymentKey, orderId, amount }  + Basic 인증(시크릿 키)
 * 시크릿 키는 절대 프론트에 두지 않습니다. (paymentApi.confirm 참고)
 *
 * ── 모드 (VITE_PAYMENT_MODE) ───────────────────────────────
 *   auto (기본) — 클라이언트 키가 있으면 실제 결제창, 없으면 모의 결제
 *   toss        — 항상 실제 결제창
 *   mock        — 항상 모의 결제
 */

export type GatewayResult =
  | { ok: true; auth: PaymentAuthResult }
  | { ok: false; failure: PaymentFailure };

/**
 * 화면의 결제수단 → 토스 `method`.
 *
 * 간편결제는 토스에서 별도 method 가 아니라 **카드 통합결제창 안에** 들어 있습니다.
 * (`flowMode: 'DEFAULT'` 면 카드/간편결제가 한 창에 같이 나옵니다)
 */
const TOSS_METHOD: Record<PayMethod, 'CARD' | 'TRANSFER' | 'VIRTUAL_ACCOUNT'> = {
  CARD: 'CARD',
  EASY_PAY: 'CARD',
  TRANSFER: 'TRANSFER',
  VIRTUAL_ACCOUNT: 'VIRTUAL_ACCOUNT',
};

export interface RequestPaymentParams {
  prepared: PaymentPrepareResponse;
  payMethod: PayMethod;
  /** 인증 성공 시 돌아올 주소 */
  successUrl: string;
  /** 실패·취소 시 돌아올 주소 */
  failUrl: string;
}

/** 실제 토스페이먼츠 결제창 호출 */
async function requestViaToss({
  prepared,
  payMethod,
  successUrl,
  failUrl,
}: RequestPaymentParams): Promise<GatewayResult> {
  if (!env.payment.configured) {
    return {
      ok: false,
      failure: {
        code: 'CONFIG_MISSING',
        message: '결제 설정이 없습니다. .env 의 VITE_TOSS_CLIENT_KEY 를 채워주세요.',
        canceledByUser: false,
      },
    };
  }

  // SDK 는 실제로 쓸 때만 내려받습니다. mock 모드에서는 로드되지 않습니다.
  const { loadTossPayments, ANONYMOUS } = await import('@tosspayments/tosspayments-sdk');

  try {
    const tossPayments = await loadTossPayments(env.payment.clientKey);

    // customerKey 는 자동결제(빌링)용 회원 식별자입니다.
    // 일반결제만 쓰므로 비회원(ANONYMOUS)으로 둡니다.
    const payment = tossPayments.payment({ customerKey: ANONYMOUS });

    const common = {
      amount: { currency: 'KRW', value: prepared.totalAmount },
      // 토스 규격: 6~64자, 영문·숫자·`-`·`_` 만 허용. 서버가 이 규칙으로 만들어야 합니다.
      orderId: prepared.paymentId,
      // 100자 제한. 넘치면 요청이 거부됩니다.
      orderName: prepared.orderName.slice(0, 90),
      successUrl,
      failUrl,
      customerName: prepared.customer.fullName,
      customerEmail: prepared.customer.email,
      // 하이픈이 있으면 거부되므로 숫자만 남깁니다.
      customerMobilePhone: prepared.customer.phoneNumber.replace(/[^0-9]/g, ''),
    } as const;

    /* requestPayment 는 결제수단별 오버로드입니다.
       method 를 유니온으로 넘기면 타입이 맞지 않으니 분기해서 호출합니다. */
    const method = TOSS_METHOD[payMethod];

    if (method === 'TRANSFER') {
      await payment.requestPayment({ method: 'TRANSFER', ...common });
    } else if (method === 'VIRTUAL_ACCOUNT') {
      await payment.requestPayment({ method: 'VIRTUAL_ACCOUNT', ...common });
    } else {
      // 카드/간편결제 통합결제창. flowMode DEFAULT 면 카드와 간편결제가 한 창에 나옵니다.
      await payment.requestPayment({
        method: 'CARD',
        ...common,
        card: { flowMode: 'DEFAULT', useEscrow: false, useCardPoint: false, useAppCardOnly: false },
      });
    }

    // 여기까지 오면 리디렉션이 시작된 것입니다. 결과는 successUrl 에서 받습니다.
    return {
      ok: false,
      failure: { code: 'REDIRECTED', message: '결제창으로 이동합니다.', canceledByUser: false },
    };
  } catch (error) {
    // 사용자가 창을 닫거나 결제창 자체가 실패하면 여기로 옵니다.
    const { code, message } = error as { code?: string; message?: string };

    /* 클라이언트 키가 실제 상점과 연결되지 않으면 SDK 가 code 'UNKNOWN' 에
       "알 수 없는 에러" 만 주고 끝납니다. 그대로 보여주면 원인을 못 찾으니
       진단 가능한 문구로 바꿔줍니다. (개발 모드에서만) */
    if (code === 'UNKNOWN' && env.isDev) {
      return {
        ok: false,
        failure: {
          code: 'CLIENT_KEY_REJECTED',
          message:
            '결제창을 열 수 없습니다. VITE_TOSS_CLIENT_KEY 가 유효한 상점 키인지 확인하세요. ' +
            '(토스페이먼츠 개발자센터 > 내 개발정보 의 테스트 클라이언트 키)',
          canceledByUser: false,
        },
      };
    }

    return { ok: false, failure: toPaymentFailure(code, message) };
  }
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
    auth: {
      paymentId: prepared.paymentId,
      paymentKey: `mock_pk_${crypto.randomUUID().replace(/-/g, '')}`,
      amount: prepared.totalAmount,
    },
  };
}

/** 결제창을 띄웁니다. 실제 결제는 리디렉션으로 결과가 돌아옵니다. */
export function requestPayment(params: RequestPaymentParams): Promise<GatewayResult> {
  return env.payment.mode === 'toss' ? requestViaToss(params) : requestViaMock(params);
}

/**
 * 결제창에서 돌아왔을 때 쿼리에서 결과를 읽습니다.
 *
 * 성공(successUrl): `paymentKey`, `orderId`, `amount`
 * 실패(failUrl):    `code`, `message`, `orderId`
 * 결제와 무관한 진입이면 null.
 *
 * ⚠️ 여기서 읽은 `amount` 는 **주소창에 있던 값**입니다. 사용자가 고칠 수 있습니다.
 *    백엔드가 승인할 때 자기가 저장한 금액과 반드시 비교해야 합니다.
 */
export function readRedirectResult(search: string): GatewayResult | null {
  const params = new URLSearchParams(search);

  const code = params.get('code');
  if (code) {
    return { ok: false, failure: toPaymentFailure(code, params.get('message') ?? undefined) };
  }

  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  if (!paymentKey || !orderId) return null;

  return {
    ok: true,
    auth: {
      paymentId: orderId,
      paymentKey,
      amount: Number(params.get('amount') ?? 0),
    },
  };
}
