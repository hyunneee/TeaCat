import type { PayMethod, PaymentFailure } from './payment.types';

/**
 * 사용자가 결제창을 닫은 것인지, 진짜 실패인지 구분합니다.
 *
 * 취소를 에러로 처리하면 "결제 실패했습니다" 토스트가 뜨는데,
 * 사용자는 그냥 창을 닫은 것이라 무슨 문제가 생긴 줄 알고 불안해합니다.
 *
 * 아래 코드는 토스페이먼츠가 실제로 내려주는 값들입니다.
 * (실패 코드 전체 목록: https://docs.tosspayments.com/reference/error-codes)
 */
const CANCEL_CODES = new Set([
  'PAY_PROCESS_CANCELED', // 사용자가 결제창을 닫음
  'USER_CANCEL',
  'CANCELED',
]);

/** 코드가 새로 생겨도 놓치지 않도록 문구로 한 번 더 확인합니다. */
const CANCEL_HINTS = ['취소', 'cancel', 'CANCEL', '닫기'];

export function toPaymentFailure(
  code: string | undefined,
  message: string | undefined,
): PaymentFailure {
  const safeCode = code ?? 'UNKNOWN';
  const safeMessage = message ?? '결제를 완료하지 못했습니다.';

  const canceledByUser =
    CANCEL_CODES.has(safeCode) || CANCEL_HINTS.some((hint) => safeMessage.includes(hint));

  return { code: safeCode, message: safeMessage, canceledByUser };
}

/** 화면 표시용 이름. PG 코드를 화면에 그대로 쓰지 않기 위해 여기서 변환합니다. */
export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  CARD: '신용/체크카드',
  EASY_PAY: '간편결제',
  TRANSFER: '계좌이체',
  VIRTUAL_ACCOUNT: '가상계좌',
};
