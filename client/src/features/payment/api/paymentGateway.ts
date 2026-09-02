import { env } from '@/shared/config';
import type {
  PaymentAuthResult,
  PaymentFailure,
  PaymentPrepareResponse,
} from '../model/payment.types';
import { toPaymentFailure } from '../model/payment.model';

/**
 * 결제 게이트웨이 어댑터 — **토스페이먼츠 결제위젯** 연동.
 *
 * ── 이 파일이 존재하는 이유 ────────────────────────────────
 * PG SDK 호출을 여기 한 곳에 격리합니다. 그래야
 *   - PG 를 바꿔도 이 파일만 고치면 되고
 *   - 실제 결제 없이도 전체 플로우를 돌릴 수 있고 (mock 모드)
 *   - 훅·화면은 "결제 요청하고 결과 받기" 라는 개념만 알면 됩니다
 *
 * ── 결제창과 결제위젯, 둘 다 지원합니다 ────────────────────
 * 토스의 클라이언트 키는 두 종류이고 **서로 호환되지 않습니다.**
 *
 *   test_ck_...   API 개별 연동 키  → `tossPayments.payment()`  → **새 창 결제창**
 *   test_gck_...  결제위젯 연동 키  → `tossPayments.widgets()`  → 페이지에 삽입
 *
 * 잘못 짝지으면 SDK 가 이렇게 거절합니다:
 *   "API 개별 연동 키의 클라이언트 키로 SDK를 연동해주세요.
 *    결제위젯 연동 키는 지원하지 않습니다."
 *
 * 그래서 **키 접두사로 자동 판별**합니다(`env.payment.widgetKey`).
 * 개별 연동 키를 발급받아 `.env` 에 넣으면 코드 수정 없이 새 창 결제창으로 바뀝니다.
 *
 * 토스가 가입 없이 공개한 문서용 테스트 키는 **위젯 키뿐**이라 기본은 위젯입니다.
 * 위젯은 페이지 안에 삽입되는 UI 라, 화면이 먼저 `mountWidget()` 으로
 * 자리를 잡아야 결제를 요청할 수 있습니다. (`TossPaymentSheet` 이 시트 안에 띄웁니다)
 *
 *   mountWidget()  → [결제수단 · 약관 UI 삽입]
 *   requestPayment() → successUrl?paymentKey=..&orderId=..&amount=..
 *                    → failUrl?code=..&message=..&orderId=..
 *
 * ── 승인은 프론트가 하지 않습니다 ──────────────────────────
 * 여기서 얻는 건 **인증(authentication)** 까지입니다.
 * 실제 승인은 백엔드가 토스 결제 승인 API 를 호출해야 완료됩니다.
 *   POST https://api.tosspayments.com/v1/payments/confirm
 *   { paymentKey, orderId, amount }  + Basic 인증(시크릿 키)
 * 시크릿 키는 절대 프론트에 두지 않습니다. (paymentApi.confirm 참고)
 *
 * ── 모드 (VITE_PAYMENT_MODE) ───────────────────────────────
 *   auto (기본) — 클라이언트 키가 있으면 실제 위젯, 없으면 모의 결제
 *   toss        — 항상 실제 위젯
 *   mock        — 항상 모의 결제
 */

export type GatewayResult =
  | { ok: true; auth: PaymentAuthResult }
  | { ok: false; failure: PaymentFailure };

/**
 * 위젯 인스턴스 중 **우리가 쓰는 것만** 적은 최소 형태.
 *
 * SDK 타입을 그대로 들고 오면 이 파일 밖까지 SDK 타입이 새어 나갑니다.
 * PG 를 갈아끼울 때 고쳐야 할 범위를 이 파일 안에 가둡니다.
 */
interface Widgets {
  setAmount(amount: { currency: 'KRW'; value: number }): Promise<void>;
  renderPaymentMethods(options: { selector: string }): Promise<unknown>;
  renderAgreement(options: { selector: string }): Promise<unknown>;
  requestPayment(options: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerName?: string;
    customerEmail?: string;
    customerMobilePhone?: string;
  }): Promise<unknown>;
}

/**
 * 지금 화면에 떠 있는 위젯 하나.
 *
 * 결제 페이지는 앱에 한 번에 하나뿐이라 모듈에 하나만 둡니다.
 * (훅이 들고 다니면 `usePayment` 까지 위젯 존재를 알아야 해서 화면이 PG 를 알게 됩니다)
 */
let mounted: Widgets | null = null;

export interface MountWidgetParams {
  /** 위젯이 처음 보여줄 금액. 결제 직전에 서버 금액으로 다시 맞춥니다. */
  amount: number;
  /** 결제수단 UI 를 넣을 자리 (CSS 선택자) */
  methodsSelector: string;
  /** 약관 UI 를 넣을 자리 (CSS 선택자) */
  agreementSelector: string;
}

/**
 * 결제위젯을 화면에 그립니다. 성공하면 null, 실패하면 사유를 돌려줍니다.
 * mock 모드에서는 아무것도 하지 않습니다(SDK 자체를 내려받지 않습니다).
 */
export async function mountWidget(params: MountWidgetParams): Promise<PaymentFailure | null> {
  // 새 창 결제창을 쓰는 키라면 삽입할 UI 자체가 없습니다.
  if (env.payment.mode !== 'toss' || !env.payment.widgetKey) return null;

  if (!env.payment.configured) {
    return {
      code: 'CONFIG_MISSING',
      message: '결제 설정이 없습니다. .env 의 VITE_TOSS_CLIENT_KEY 를 채워주세요.',
      canceledByUser: false,
    };
  }

  try {
    // SDK 는 실제로 쓸 때만 내려받습니다.
    const { loadTossPayments, ANONYMOUS } = await import('@tosspayments/tosspayments-sdk');
    const tossPayments = await loadTossPayments(env.payment.clientKey);

    // customerKey 는 자동결제(빌링)용 회원 식별자입니다. 일반결제만 쓰므로 비회원.
    const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });

    // 금액을 먼저 정해야 결제수단 UI 를 그릴 수 있습니다.
    await widgets.setAmount({ currency: 'KRW', value: params.amount });
    await Promise.all([
      widgets.renderPaymentMethods({ selector: params.methodsSelector }),
      widgets.renderAgreement({ selector: params.agreementSelector }),
    ]);

    mounted = widgets as unknown as Widgets;
    return null;
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    return toPaymentFailure(code, message);
  }
}

/** 화면을 떠날 때 정리합니다. */
export function unmountWidget(): void {
  mounted = null;
}

export interface RequestPaymentParams {
  prepared: PaymentPrepareResponse;
  /** 인증 성공 시 돌아올 주소 */
  successUrl: string;
  /** 실패·취소 시 돌아올 주소 */
  failUrl: string;
}

/**
 * 새 창 결제창 (API 개별 연동 키 전용).
 *
 * `payment.requestPayment()` 는 토스가 띄우는 **별도 결제창**에서 인증을 받습니다.
 * 페이지에 아무것도 삽입하지 않으므로 화면이 미리 준비할 게 없습니다.
 */
async function requestViaPaymentWindow({
  prepared,
  successUrl,
  failUrl,
}: RequestPaymentParams): Promise<GatewayResult> {
  try {
    const { loadTossPayments, ANONYMOUS } = await import('@tosspayments/tosspayments-sdk');
    const tossPayments = await loadTossPayments(env.payment.clientKey);
    const payment = tossPayments.payment({ customerKey: ANONYMOUS });

    await payment.requestPayment({
      // 통합결제창 — 카드와 토스페이·네이버페이가 한 창에 나옵니다.
      method: 'CARD',
      amount: { currency: 'KRW', value: prepared.totalAmount },
      orderId: prepared.paymentId,
      orderName: prepared.orderName.slice(0, 90),
      successUrl,
      failUrl,
      customerName: prepared.customer.fullName,
      customerEmail: prepared.customer.email,
      customerMobilePhone: prepared.customer.phoneNumber.replace(/[^0-9]/g, ''),
      card: { flowMode: 'DEFAULT', useEscrow: false, useCardPoint: false, useAppCardOnly: false },
    });

    return {
      ok: false,
      failure: { code: 'REDIRECTED', message: '결제를 진행합니다.', canceledByUser: false },
    };
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    return { ok: false, failure: toPaymentFailure(code, message) };
  }
}

/** 결제위젯으로 결제 요청 (위젯 키 전용) */
async function requestViaToss({
  prepared,
  successUrl,
  failUrl,
}: RequestPaymentParams): Promise<GatewayResult> {
  if (!mounted) {
    return {
      ok: false,
      failure: {
        code: 'WIDGET_NOT_READY',
        message: '결제 수단을 불러오는 중입니다. 잠시 후 다시 눌러주세요.',
        canceledByUser: false,
      },
    };
  }

  try {
    /* 💡 금액은 서버가 확정한 값으로 다시 맞춥니다.
          화면에서 계산한 금액을 그대로 결제하면 요청을 조작해 1원 결제를 만들 수 있습니다. */
    await mounted.setAmount({ currency: 'KRW', value: prepared.totalAmount });

    await mounted.requestPayment({
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
    });

    // 여기까지 오면 리디렉션이 시작된 것입니다. 결과는 successUrl 에서 받습니다.
    return {
      ok: false,
      failure: { code: 'REDIRECTED', message: '결제를 진행합니다.', canceledByUser: false },
    };
  } catch (error) {
    // 사용자가 취소하거나 요청 자체가 거부되면 여기로 옵니다.
    const { code, message } = error as { code?: string; message?: string };
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

/** 결제를 요청합니다. 실제 결제는 리디렉션으로 결과가 돌아옵니다. */
export function requestPayment(params: RequestPaymentParams): Promise<GatewayResult> {
  if (env.payment.mode !== 'toss') return requestViaMock(params);
  return env.payment.widgetKey ? requestViaToss(params) : requestViaPaymentWindow(params);
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
