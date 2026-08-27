import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/api';
import { readRedirectResult } from '../api/paymentGateway';
import { useConfirmPayment } from './usePayment';
import type { PaymentFailure } from '../model/payment.types';

export type ResultState =
  /** 결과를 읽고 승인 요청 중 */
  | { status: 'confirming' }
  /** 결제창에서 실패했거나 사용자가 취소 */
  | { status: 'failed'; failure: PaymentFailure }
  /** 결제는 됐는데 승인이 실패 — 가장 위험한 상태 */
  | { status: 'confirm-failed'; message: string }
  /** 결제와 무관한 진입 (주소를 직접 입력한 경우) */
  | { status: 'invalid' };

/**
 * 모바일 결제창에서 돌아왔을 때 결과를 처리합니다.
 *
 * 결제창은 모바일에서 페이지를 이동시키고, 인증이 끝나면
 * `redirectUrl` 로 쿼리 파라미터(paymentId, txId, code, message)를 붙여 돌려보냅니다.
 * 여기서 그 값을 읽어 백엔드 승인으로 이어붙입니다.
 *
 * ⚠️ 이 화면은 얼굴 등록·OTP 가드 밖에 있어야 합니다.
 *    가드에 막히면 "결제는 됐는데 티켓이 없는" 최악의 상태가 됩니다.
 *
 * ⚠️ 승인 요청은 한 번만 보냅니다. 사용자가 새로고침해도
 *    쿼리를 지워두고 ref 로 잠가서 중복 승인을 막습니다.
 *    (그래도 서버는 멱등키로 한 번 더 방어합니다)
 */
export function usePaymentResult() {
  const [state, setState] = useState<ResultState>({ status: 'confirming' });
  const confirm = useConfirmPayment();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const result = readRedirectResult(window.location.search);

    // 주소창에 직접 들어온 경우
    if (!result) {
      setState({ status: 'invalid' });
      return;
    }

    // 새로고침으로 같은 결과가 다시 처리되지 않게 쿼리를 지웁니다.
    window.history.replaceState({}, '', window.location.pathname);

    if (!result.ok) {
      setState({ status: 'failed', failure: result.failure });
      return;
    }

    setState({ status: 'confirming' });
    confirm.mutate(
      // 리디렉션 복귀 시점에는 어떤 수단으로 결제했는지 알 수 없습니다.
      // 백엔드가 포트원 조회로 실제 수단을 알 수 있으므로 참고값만 보냅니다.
      { auth: result.auth, payMethod: 'CARD' },
      {
        onError: (error) =>
          setState({
            status: 'confirm-failed',
            message: ApiError.isApiError(error)
              ? error.message
              : '결제 승인에 실패했습니다. 결제 내역을 확인해 주세요.',
          }),
      },
    );
    // confirm 은 매 렌더 새로 만들어지므로 의존성에서 제외합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
