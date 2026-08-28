import { useEffect, useState } from 'react';
import { env } from '@/shared/config';
import { mountWidget, unmountWidget } from '../api/paymentGateway';

/** 위젯을 그릴 자리. 화면과 게이트웨이가 같은 값을 봐야 해서 여기 둡니다. */
export const TOSS_METHODS_ID = 'toss-payment-methods';
export const TOSS_AGREEMENT_ID = 'toss-agreement';

export type TossWidgetStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

/**
 * 토스 결제위젯을 화면에 띄웁니다.
 *
 * 결제위젯은 팝업이 아니라 **페이지 안에 삽입**되는 UI 라서,
 * 결제 버튼을 누르기 전에 미리 자리를 잡아둬야 합니다.
 *
 * ⚠️ `amount` 가 바뀌어도 다시 마운트하지 않습니다.
 *    위젯을 다시 그리면 사용자가 고르던 카드 선택이 초기화됩니다.
 *    금액은 결제 직전에 **서버가 확정한 값**으로 다시 맞춥니다. (paymentGateway)
 */
export function useTossWidget(enabled: boolean, initialAmount: number) {
  const [status, setStatus] = useState<TossWidgetStatus>('idle');
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    if (env.payment.mode !== 'toss') {
      setStatus('unavailable');
      return;
    }

    let alive = true;
    setStatus('loading');

    void mountWidget({
      amount: initialAmount,
      methodsSelector: `#${TOSS_METHODS_ID}`,
      agreementSelector: `#${TOSS_AGREEMENT_ID}`,
    }).then((failure) => {
      if (!alive) return;
      if (failure) {
        setStatus('error');
        setMessage(failure.message);
        return;
      }
      setStatus('ready');
    });

    return () => {
      alive = false;
      unmountWidget();
    };
    // initialAmount 는 의도적으로 제외합니다 (위 주석 참고)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { status, message };
}
