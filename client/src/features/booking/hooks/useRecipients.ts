import { useEffect, useMemo } from 'react';
import { useAuth } from '@/features/auth';
import { useBookingStore } from '../store/bookingStore';

/**
 * 티켓 수령인 지정.
 *
 * 이 서비스는 예매 후 단순 양도를 막습니다.
 * 대신 **결제 시점에** 좌석마다 받을 사람의 아이디를 확정하게 합니다.
 * 기본값은 본인이고, 일행 좌석만 아이디를 바꾸면 됩니다.
 *
 * ⚠️ 기본값을 화면에서만 보여주고 스토어에 넣지 않으면
 *    "보이는 값과 전송되는 값이 다른" 사고가 납니다. 반드시 스토어까지 채웁니다.
 */
export function useRecipients(seatIds: readonly string[]) {
  const { user } = useAuth();
  const recipients = useBookingStore((s) => s.recipients);
  const setRecipient = useBookingStore((s) => s.setRecipient);

  const myLoginId = user?.nickname ?? '';

  // 아직 지정되지 않은 좌석은 본인으로 채워 둡니다.
  useEffect(() => {
    if (!myLoginId) return;
    const assigned = new Set(recipients.map((r) => r.seatId));
    seatIds
      .filter((seatId) => !assigned.has(seatId))
      .forEach((seatId) => {
        setRecipient(seatId, myLoginId);
      });
  }, [seatIds, recipients, myLoginId, setRecipient]);

  const valueOf = (seatId: string) =>
    recipients.find((r) => r.seatId === seatId)?.loginId ?? myLoginId;

  const filled = useMemo(
    () =>
      seatIds.every((seatId) => {
        const found = recipients.find((r) => r.seatId === seatId);
        return (found?.loginId ?? '').trim().length > 0;
      }),
    [seatIds, recipients],
  );

  return { valueOf, setRecipient, filled, myLoginId };
}
