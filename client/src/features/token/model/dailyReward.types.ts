/**
 * 하루 한 번 받는 캣머니 보상 — 출석 체크와 송편 잡기.
 *
 * 🔴 **금액도 "오늘 받았는지" 도 서버가 정합니다.** 지급 요청에는 금액 자리가 없고
 * (`POST /users/me/rewards/attendance` 는 본문이 비어 있습니다), 화면은 `amount` 를
 * 받아서 보여주기만 합니다. 화면에 500·1000 을 적어 두면 금액을 바꿀 때 두 곳을
 * 고쳐야 하고 배포 순서에 따라 화면이 거짓말을 합니다. (CLAUDE.md 3-5 · 7장)
 */

export type RewardType = 'ATTENDANCE' | 'SONGPYEON';

/**
 * 화면이 분기하는 서버 에러 코드.
 *
 * 🔴 **문자열을 바꾸지 마세요** — 서버의 `RewardErrorCode` 와 한 쌍입니다
 * (server/CLAUDE.md 3-2: 한 번 나간 코드는 바꾸지 않습니다).
 */
export const REWARD_ERROR = {
  /** 오늘 이미 받았습니다 (409) */
  ALREADY_CLAIMED: 'ERR_REWARD_001',
} as const;

/** 보상 한 종류의 오늘 상태 */
export interface RewardState {
  type: RewardType;
  /** 받으면 들어오는 금액. **화면에 적지 말고 이 값을 쓰세요** */
  amount: number;
  claimed: boolean;
  /** 받은 시각. 아직 안 받았으면 null */
  claimedAt: string | null;
}

/**
 * 오늘의 보상 현황.
 *
 * `date` 는 **서버(Asia/Seoul) 기준 날짜**입니다. "내일 다시" 가 언제인지는 기기 시계가
 * 아니라 서버가 정합니다 — 기기 시간대가 다르면 자정이 어긋납니다.
 */
export interface DailyRewardStatus {
  date: string;
  rewards: RewardState[];
}

/**
 * 지급 요청 결과.
 *
 * 🔴 **`PENDING` 이면 잔액은 아직 그대로입니다.** 체인 확정까지 블록 하나(약 10초)가
 * 걸립니다. 곧바로 잔액을 다시 부르면 옛 값이 와서 "안 들어왔다" 로 보입니다 —
 * `useClaimDailyReward` 가 잠시 뒤 한 번 더 무효화하는 이유입니다.
 */
export interface RewardClaimResult {
  type: RewardType;
  amount: number;
  date: string;
  status: 'PENDING' | 'CONFIRMED' | 'ALREADY_DONE' | 'FAILED';
}
