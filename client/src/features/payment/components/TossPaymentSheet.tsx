import { Modal, Button } from '@/shared/components/ui';
import { formatPrice } from '@/shared/lib';
import { TOSS_AGREEMENT_ID, TOSS_METHODS_ID, useTossWidget } from '../hooks/useTossWidget';

interface Props {
  open: boolean;
  /** 위젯이 처음 보여줄 금액. 실제 결제 금액은 서버가 확정합니다. */
  amount: number;
  /** 결제 진행 중 — 시트를 닫지 못하게 잠급니다 */
  paying: boolean;
  /** 버튼에 띄울 진행 문구 (없으면 금액) */
  stageLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 토스 결제위젯을 **시트로** 띄웁니다.
 *
 * 위젯은 팝업이 아니라 페이지에 삽입되는 UI 라, 결제 페이지 본문에 그대로 붙이면
 * 화면이 500px 쯤 길어지고 주변 요소와 겹쳐 누르기 어려워집니다.
 * 시트 안에 넣으면 결제할 때만 화면을 덮어 새 창처럼 동작합니다.
 *
 * (API 개별 연동 키 `test_ck_...` 를 쓰면 토스가 **진짜 새 창**을 띄우므로
 *  이 시트는 필요 없습니다 — `env.payment.widgetKey` 로 갈립니다)
 *
 * 결제가 진행되는 동안에는 닫히지 않습니다. 중간에 닫으면 사용자는
 * 결제가 취소된 줄 알지만 실제로는 창이 떠 있을 수 있습니다.
 */
export function TossPaymentSheet({
  open,
  amount,
  paying,
  stageLabel,
  onClose,
  onConfirm,
}: Props) {
  const widget = useTossWidget(open, amount);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="결제 수단 선택"
      variant="sheet"
      dismissible={!paying}
      footer={
        <Button
          variant="dark"
          size="lg"
          fullWidth
          loading={paying}
          disabled={widget.status !== 'ready'}
          onClick={onConfirm}
        >
          {paying ? (stageLabel ?? '진행 중') : `${formatPrice(amount)} 결제하기`}
        </Button>
      }
    >
      <div id={TOSS_METHODS_ID} className="min-h-40" />
      <div id={TOSS_AGREEMENT_ID} />

      {widget.status === 'loading' && (
        <p className="text-subtle py-6 text-center text-sm">결제 수단을 불러오는 중…</p>
      )}
      {widget.status === 'error' && (
        <p className="text-danger py-6 text-center text-sm">{widget.message}</p>
      )}
    </Modal>
  );
}
