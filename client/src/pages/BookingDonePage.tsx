import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { House, ScanFace, Ticket } from 'lucide-react';
import { Button, Card, CatMascot } from '@/shared/components/ui';
import { Confetti } from '@/shared/components/common';
import { ROUTES } from '@/shared/constants';
import { useAuth, can } from '@/features/auth';
import { useBookingStore } from '@/features/booking';
import { PocaPackGotModal } from '@/features/nft';
import { useLeaveQueue } from '@/features/queue';

/**
 * 예매 완료.
 *
 * 🔴 <b>여기서 나가는 길은 전부 `replace` 입니다.</b> 새 버튼을 추가할 때도 지키세요.
 *
 * 한 곳이라도 `push` 면 그 화면에서 뒤로가기를 눌렀을 때 이 페이지로 **되돌아옵니다.**
 * 그러면 폭죽이 다시 터지고 "예매가 완료되었습니다" 와 카드팩 모달이 또 뜹니다 —
 * 예매가 한 번 더 된 것처럼 보여서 실제로 혼란스럽다는 제보를 받았습니다
 * (카드팩 모달의 "보러 가기" 가 `push` 였습니다).
 *
 * 결제 승인도 이 화면으로 `replace` 로 들어옵니다(`useConfirmPayment`). 그래서 나갈 때까지
 * `replace` 로 맞추면 완료 화면은 **히스토리에 아예 남지 않습니다.**
 */
export function BookingDonePage() {
  const navigate = useNavigate();
  const { orderId = '' } = useParams();
  const { user } = useAuth();

  // 예매 플로우 상태 정리.
  // 결제 훅에서 하면 결제 페이지의 "선점 없음" 가드가 먼저 발동해 튕깁니다.
  const reset = useBookingStore((s) => s.reset);
  useEffect(() => reset(), [reset]);

  /* 대기실 자리 비우기. 예매가 끝났으니 다음 분이 들어오게 합니다.
     scheduleId 는 첫 렌더에서 읽어 둡니다 — 위 reset 이 effect 에서 지우기 전 값입니다.
     실패해도 무시합니다. 서버 TTL(10분)이 뒤처리합니다. */
  const queueScheduleId = useBookingStore((s) => s.scheduleId);
  const leaveQueue = useLeaveQueue();
  const leaveMutate = leaveQueue.mutate;
  useEffect(() => {
    if (queueScheduleId) leaveMutate(queueScheduleId);
    // 마운트 시 한 번. reset 뒤 scheduleId 가 null 로 바뀌어도 다시 부르지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needsFace = !can.useTicket(user);

  /**
   * 티켓을 사면 서버가 **표 한 장당 카드팩 하나**를 줍니다(`TicketOrderRecorder`).
   * 알려 주지 않으면 받은 줄 모르고, 공연 당일에도 안 열어 봅니다.
   *
   * 🔴 폭죽이 터지는 동안은 띄우지 않습니다 — 완료를 알아보기도 전에 모달이 덮으면
   * "예매가 된 건가?" 가 남습니다.
   */
  const [gotPack, setGotPack] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGotPack(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      {/* 예매가 끝나는 지점 — 여기 한 곳에서만 터뜨립니다. 다 떨어지면 스스로 정리합니다. */}
      <Confetti />

      <PocaPackGotModal
        open={gotPack}
        onClose={() => setGotPack(false)}
        onGo={() => navigate(ROUTES.MY_NFTS, { replace: true })}
      />

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
        {/* 이 화면의 주 행동은 티켓 확인입니다. 얼굴 등록은 안내이지 이 화면의 목적이 아닙니다. */}
        <Button
          variant="dark"
          size="lg"
          fullWidth
          leftIcon={<Ticket size={18} />}
          onClick={() => navigate(ROUTES.MY_TICKETS, { replace: true })}
        >
          내 티켓 보기
        </Button>
        {needsFace && (
          /* 흰 화면에 흰 버튼(secondary)을 두면 눌러야 할 게 있는 줄 모릅니다.
             회색 면으로 세우되, 주 행동(내 티켓 보기)보다는 약하게. */
          <Button
            size="lg"
            variant="soft"
            fullWidth
            onClick={() => navigate(ROUTES.FACE_REGISTER, { replace: true })}
          >
            얼굴 등록하러 가기
          </Button>
        )}
        <Button
          variant="soft"
          size="lg"
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
