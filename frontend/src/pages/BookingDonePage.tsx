import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { House, ScanFace, Ticket } from 'lucide-react';
import { Button, Card, CatMascot } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { useAuth, can } from '@/features/auth';
import { useBookingStore } from '@/features/booking';

export function BookingDonePage() {
  const navigate = useNavigate();
  const { orderId = '' } = useParams();
  const { user } = useAuth();

  // 예매 플로우 상태 정리.
  // 결제 훅에서 하면 결제 페이지의 "선점 없음" 가드가 먼저 발동해 튕깁니다.
  const reset = useBookingStore((s) => s.reset);
  useEffect(() => reset(), [reset]);

  const needsFace = !can.useTicket(user);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      {/* 체크 표시 하나로 충분합니다. 축포·파티클은 한 번 보고 나면 방해만 됩니다. */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="bg-success-soft border-success/40 flex size-24 items-center justify-center rounded-full border"
      >
        <CatMascot mood="happy" size={62} />
      </motion.div>

      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-bold">예매가 완료되었습니다</h1>
        <p className="text-subtle text-sm">
          예매번호 <span className="text-muted font-mono">{orderId}</span>
        </p>
      </div>

      {needsFace && (
        <Card tone="warning" className="flex w-full max-w-sm gap-3">
          <ScanFace size={20} className="text-warning shrink-0" />
          <div className="min-w-0 space-y-1 text-xs">
            <p className="text-[0.8125rem] font-bold">아직 얼굴 등록이 안 됐어요</p>
            <p className="text-muted leading-relaxed">
              등록하지 않으면 입장할 수 없습니다. 공연 전에 꼭 등록해 주세요.
            </p>
          </div>
        </Card>
      )}

      <div className="flex w-full max-w-sm flex-col gap-2">
        {needsFace && (
          <Button size="lg" fullWidth onClick={() => navigate(ROUTES.FACE_REGISTER)}>
            얼굴 등록하러 가기
          </Button>
        )}
        <Button
          size="lg"
          variant={needsFace ? 'secondary' : 'primary'}
          fullWidth
          leftIcon={<Ticket size={18} />}
          onClick={() => navigate(ROUTES.MY_TICKETS, { replace: true })}
        >
          내 티켓 보기
        </Button>
        <Button
          variant="ghost"
          fullWidth
          leftIcon={<House size={16} />}
          onClick={() => navigate(ROUTES.HOME, { replace: true })}
        >
          홈으로
        </Button>
      </div>
    </div>
  );
}
