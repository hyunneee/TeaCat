import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { toast } from '@/shared/stores';
import { adminCatMoneyApi, adminCatMoneyKeys } from '../api/adminCatMoneyApi';
import type { AdminCatMoneyDirection } from '../model/adminCatMoney.types';

/**
 * 체인 확정을 기다렸다가 잔액을 다시 부르기까지의 시간.
 *
 * 블록 하나가 약 10초라 여유를 조금 둡니다. 정확한 값일 필요는 없습니다 —
 * 확정이 늦어도 관리자가 모달을 다시 열면 그때 최신값을 받습니다.
 */
const SETTLE_WAIT_MS = 12_000;

/** 서버가 내려준 메시지를 그대로 보여줍니다 (잔액 부족·지갑 없음 등) */
const showError = (error: unknown, fallback: string) =>
  toast.error(ApiError.isApiError(error) ? error.message : fallback);

/**
 * 관리자 캣머니 조정 — <b>테스트용</b>입니다.
 *
 * <p>🔴 <b>조정 직후의 잔액은 한 번에 맞지 않습니다.</b> 방향에 따라 다릅니다.
 * <ul>
 *   <li><b>차감</b> — 미확정 소각은 곧바로 가용 잔액에서 빠지므로 바로 갱신하면 맞습니다.</li>
 *   <li><b>지급</b> — 미확정 발행은 더하지 않습니다(실패할 수 있는 돈을 미리 쓰게 하면
 *       안 되니까요). 그래서 확정 전까지 <b>옛 값</b>이 옵니다.</li>
 * </ul>
 * 그래서 지금 한 번, 확정될 만한 시간 뒤에 한 번 더 부릅니다. 한 번만 부르면
 * 지급이 "안 먹혔다" 로 보입니다.
 *
 * @param userId null 이면 조회하지 않습니다 (모달이 닫힌 상태)
 */
export function useAdminCatMoney(userId: number | null) {
  /* 확정을 기다리는 타이머. 모달을 닫거나 대상을 바꾸면 취소합니다 —
     안 그러면 이미 사라진 화면 때문에 쿼리가 깨어납니다 */
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSettleTimer = () => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  };

  useEffect(() => clearSettleTimer, [userId]);

  const balance = useQuery({
    queryKey: adminCatMoneyKeys.balance(userId ?? 0),
    queryFn: () => adminCatMoneyApi.balance(userId as number),
    enabled: userId !== null,
    /* 체인에서 매번 읽어옵니다. 서버가 잔액을 저장하지 않으므로 캐시해 둘 이유가 없고,
       모달을 다시 열었을 때 옛 값을 보여주면 얼마를 뺄 수 있는지 잘못 판단하게 됩니다 */
    staleTime: 0,
  });

  const refreshBalance = (targetUserId: number) => {
    const key = adminCatMoneyKeys.balance(targetUserId);
    void queryClient.invalidateQueries({ queryKey: key });

    clearSettleTimer();
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      void queryClient.invalidateQueries({ queryKey: key });
    }, SETTLE_WAIT_MS);
  };

  const adjust = useMutation({
    mutationFn: ({
      targetUserId,
      direction,
      amount,
    }: {
      targetUserId: number;
      direction: AdminCatMoneyDirection;
      amount: number;
    }) =>
      direction === 'grant'
        ? adminCatMoneyApi.grant(targetUserId, amount)
        : adminCatMoneyApi.burn(targetUserId, amount),

    onSuccess: (result) => {
      refreshBalance(result.userId);

      const applied = result.appliedAmount.toLocaleString();

      /* 요청한 만큼 다 빠지지 않은 경우를 말해줍니다. 조용히 다른 금액을 처리하면
         관리자는 눌렀다는 것만 알고 얼마가 빠졌는지 모릅니다 */
      if (result.appliedAmount < result.requestedAmount) {
        toast.info(
          `가용 잔액만큼만 차감했어요. ${applied} 캣머니 (요청 ${result.requestedAmount.toLocaleString()})`,
        );
        return;
      }

      toast.success(
        result.reason === 'ADMIN_GRANT'
          ? `${applied} 캣머니를 지급했어요. 반영까지 10초쯤 걸려요.`
          : `${applied} 캣머니를 차감했어요.`,
      );
    },

    onError: (error) => showError(error, '캣머니 조정에 실패했어요.'),
  });

  return { balance, adjust };
}
