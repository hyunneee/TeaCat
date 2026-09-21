import { http } from '@/shared/api';
import type { DailyRewardStatus, RewardClaimResult } from '../model/dailyReward.types';
import type { TokenBalance } from '../model/token.types';

export const tokenApi = {
  balance: () => http.get<TokenBalance>('/users/me/balance'),

  /* ── 캣머니 벌기(하루 한 번 보상) ──────────────────────────
     🔴 지급 요청에 **본문이 없습니다.** 금액도 하루 한 번도 서버가 정합니다 —
     금액을 실어 보내면 콘솔에서 0 을 더 붙일 수 있습니다. (CLAUDE.md 7장) */
  dailyRewards: () => http.get<DailyRewardStatus>('/users/me/rewards/daily'),
  claimAttendance: () => http.post<RewardClaimResult>('/users/me/rewards/attendance'),
  claimSongpyeon: () => http.post<RewardClaimResult>('/users/me/rewards/songpyeon'),
};

export const tokenKeys = {
  all: ['token'] as const,
  balance: () => [...tokenKeys.all, 'balance'] as const,
  /** 오늘의 보상 현황. 날짜가 바뀌면 값이 달라지지만 **키에 날짜를 넣지 않습니다** —
      날이 바뀌는 기준은 서버라, 키에 기기 날짜를 섞으면 자정 근처에서 어긋납니다 */
  dailyRewards: () => [...tokenKeys.all, 'daily-rewards'] as const,
};
