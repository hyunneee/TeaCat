import { useNavigate, useParams } from 'react-router-dom';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { Button, Card } from '@/shared/components/ui';
import { PageLoader } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { usePaymentResult } from '@/features/payment';

/**
 * 모바일 결제창에서 돌아오는 화면.
 *
 * 승인이 성공하면 훅이 곧바로 완료 화면으로 보내므로,
 * 이 화면에 남는 경우는 "처리 중"이거나 "실패"입니다.
 */
export function PaymentResultPage() {
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams();
  const result = usePaymentResult();

  if (result.status === 'confirming') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <PageLoader />
        <p className="text-muted text-sm">결제를 확인하고 있어요. 창을 닫지 말아 주세요.</p>
      </div>
    );
  }

  /* 결제는 됐는데 승인이 실패한 경우.
     사용자가 가장 불안해하는 상황이라 "돈이 빠졌는지" 를 먼저 알려줍니다. */
  if (result.status === 'confirm-failed') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6">
        <span className="bg-danger-soft text-danger flex size-16 items-center justify-center rounded-full">
          <TriangleAlert size={30} />
        </span>
        <div className="space-y-1.5 text-center">
          <h1 className="text-lg font-bold">결제 확인에 실패했습니다</h1>
          <p className="text-muted text-sm">{result.message}</p>
        </div>
        <Card tone="danger" className="w-full max-w-sm">
          <p className="text-muted text-xs leading-relaxed">
            결제가 완료됐는데 티켓이 발급되지 않았다면 자동으로 취소·환불됩니다. 내 티켓에서 발급
            여부를 먼저 확인해 주세요.
          </p>
        </Card>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Button variant="dark" size="lg" fullWidth onClick={() => navigate(ROUTES.MY_TICKETS, { replace: true })}>
            내 티켓 확인
          </Button>
          <Button variant="ghost" fullWidth onClick={() => navigate(ROUTES.HOME, { replace: true })}>
            홈으로
          </Button>
        </div>
      </div>
    );
  }

  const canceled = result.status === 'failed' && result.failure.canceledByUser;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6">
      <span className="surface-2 border-line text-ink-subtle flex size-16 items-center justify-center rounded-full border">
        <CircleAlert size={30} />
      </span>
      <div className="space-y-1.5 text-center">
        <h1 className="text-lg font-bold">{canceled ? '결제를 취소했습니다' : '결제하지 못했습니다'}</h1>
        <p className="text-muted text-sm">
          {result.status === 'failed' ? result.failure.message : '잘못된 접근입니다.'}
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <Button
          variant="dark"
          size="lg"
          fullWidth
          onClick={() => navigate(ROUTES.BOOKING_PAYMENT(scheduleId), { replace: true })}
        >
          다시 결제하기
        </Button>
        <Button variant="ghost" fullWidth onClick={() => navigate(ROUTES.HOME, { replace: true })}>
          홈으로
        </Button>
      </div>
    </div>
  );
}
