import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError, queryClient } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { useIsLoggedIn } from '@/features/auth';
import { tokenApi, tokenKeys } from '../api/tokenApi';
import { REWARD_ERROR, type RewardState, type RewardType } from '../model/dailyReward.types';

/**
 * 체인이 발행을 확정하기까지 기다리는 시간.
 *
 * 🔴 **지급 응답이 왔다고 잔액이 늘어난 게 아닙니다.** 블록 하나(약 10초)가 지나야
 * 반영됩니다. 그래서 잔액 무효화를 **두 번** 합니다 — 지금 한 번(쓸 수 있는 돈이
 * 바뀌는 다른 경로와 발을 맞추고), 확정될 무렵 한 번. 한 번만 하면 사용자는 "받았는데
 * 잔액이 그대로" 를 보고 새로고침을 하러 갑니다.
 */
const CHAIN_SETTLE_MS = 12_000;

/** 보상 종류 → 상태. 없는 종류(서버에 아직 없는 값)는 undefined 입니다 */
export type DailyRewards = Partial<Record<RewardType, RewardState>>;

/**
 * 오늘의 보상 현황.
 *
 * 개인 데이터라 로그인 상태에서만 조회합니다(비로그인에서 부르면 401 → 로그인 화면).
 *
 * 🔴 **자정을 넘겨도 스스로 바뀌지 않습니다.** 날이 바뀌는 기준은 서버(Asia/Seoul)라
 * 화면이 판단할 수 없습니다. 탭에 돌아올 때 다시 받아서(`refetchOnWindowFocus`) 어제
 * 받은 상태가 오늘까지 남지 않게 합니다 — 응답이 작고 개인 값이라 켜 둡니다.
 */
export function useDailyRewards() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: tokenKeys.dailyRewards(),
    queryFn: tokenApi.dailyRewards,
    enabled: isLoggedIn,
    staleTime: STALE_TIME.SHORT,
    refetchOnWindowFocus: true,
    select: (data): DailyRewards =>
      Object.fromEntries(data.rewards.map((reward) => [reward.type, reward])),
  });
}

/**
 * 보상 받기.
 *
 * 🔴 **금액을 보내지 않습니다.** 금액도 하루 한 번도 서버가 정합니다 —
 * 화면은 "눌렀다" 만 알립니다. (`dailyReward.types` 주석)
 *
 * 이미 받은 날 다시 부르면 409(`ERR_REWARD_001`)입니다. 이건 **사고가 아니라 규칙**이라
 * 붉은 토스트를 띄우지 않고, 현황만 다시 받아 화면이 "오늘은 끝" 상태로 넘어가게 둡니다 —
 * 무엇을 보여줄지는 부르는 화면이 정합니다(송편 게임은 자기 문구가 따로 있습니다).
 */
function useClaimDailyReward(type: RewardType) {
  return useMutation({
    mutationFn: type === 'ATTENDANCE' ? tokenApi.claimAttendance : tokenApi.claimSongpyeon,
    /* 두 번 청구할 이유가 없습니다. 실패는 사용자가 다시 누르게 둡니다 */
    retry: false,
    onSuccess: (result) => {
      /* 출석은 누른 자리에서 끝나는 동작이라 토스트로 결과를 말해 줍니다.
         송편은 클리어 모달이 대신 말하므로 여기서 또 띄우지 않습니다 — 둘 다 뜨면 겹칩니다.
         🔴 금액은 서버가 준 값입니다. 화면에 500 을 적지 마세요 (`dailyReward.types` 주석) */
      if (type === 'ATTENDANCE') {
        toast.success(`출석 체크 완료! 캣머니 ${result.amount.toLocaleString()}이 곧 들어와요.`);
      }
      void queryClient.invalidateQueries({ queryKey: tokenKeys.dailyRewards() });
      void queryClient.invalidateQueries({ queryKey: tokenKeys.balance() });
      /* 체인이 확정될 무렵 한 번 더. 화면을 떠나도 돌아야 해서 컴포넌트가 아니라
         여기(모듈 싱글턴인 queryClient)에 겁니다 */
      setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: tokenKeys.balance() }),
        CHAIN_SETTLE_MS,
      );
    },
    onError: (error) => {
      if (ApiError.isApiError(error) && error.code === REWARD_ERROR.ALREADY_CLAIMED) {
        // 오늘 몫은 이미 나갔습니다. 현황을 맞춰 두면 화면이 알아서 닫힙니다
        void queryClient.invalidateQueries({ queryKey: tokenKeys.dailyRewards() });
        return;
      }
      toast.error(ApiError.isApiError(error) ? error.message : '캣머니를 받지 못했어요.');
    },
  });
}

export function useClaimSongpyeon() {
  return useClaimDailyReward('SONGPYEON');
}

/**
 * 출석 체크 — 캣머니 화면의 버튼 하나가 쓰는 전부.
 *
 * 현황 조회와 지급을 한 자리에 묶어 둡니다. 페이지가 쿼리 둘을 각각 부르고 `claimed` 를
 * 꺼내 조립하면 그게 곧 페이지에 들어간 로직입니다. (CLAUDE.md 3-6)
 */
export function useAttendance() {
  const { data, isLoading } = useDailyRewards();
  const claim = useClaimDailyReward('ATTENDANCE');
  const attendance = data?.ATTENDANCE;

  return {
    /** 받으면 들어오는 금액. 아직 못 받아왔으면 null — 화면이 금액 대신 다른 말을 합니다 */
    amount: attendance?.amount ?? null,
    claimed: attendance?.claimed ?? false,
    loading: isLoading,
    claiming: claim.isPending,
    check: claim.mutate,
  };
}

/** 이미 받은 날 다시 청구했는가 — 화면이 "오늘은 끝" 문구로 넘어갈 때 봅니다 */
export function isAlreadyClaimed(error: unknown): boolean {
  return ApiError.isApiError(error) && error.code === REWARD_ERROR.ALREADY_CLAIMED;
}
