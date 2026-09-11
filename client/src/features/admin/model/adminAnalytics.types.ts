/**
 * 운영 통계 타입 (Model 레이어).
 *
 * 서버 `analytics` 도메인의 응답 그대로입니다. 필드 이름을 바꾸지 마세요 —
 * 서버가 주인이고, 여기서 갈아끼우면 다음 사람이 두 곳을 대조해야 합니다.
 */

/** 하루치 지표 한 점. from~to 사이의 **모든** 날짜가 옵니다 (아무 일 없던 날은 0) */
export interface MemberDailyPoint {
  /** `2026-09-09` */
  date: string;
  signups: number;
  withdrawals: number;
  /**
   * 그날 접속한 회원 수 (한 사람당 하루 1).
   *
   * 🔴 `activeUsersTrackedFrom` 이전 날짜는 0 으로 오지만 그건 "아무도 안 왔다" 가
   *    아니라 **"재지 않았다"** 입니다. 가입은 소급 집계가 되고 접속은 안 됩니다.
   */
  activeUsers: number;
  /** 그날 자정 기준 누적 회원 수 (탈퇴 제외) */
  totalMembers: number;
}

/** 차트에 얹는 배포 마커. 지금은 운영(master) 배포만 옵니다 */
export interface DeploymentMarker {
  deploymentId: number;
  /** 타임존 없는 KST (`2026-09-09T14:02:11`) */
  deployedAt: string;
  branch: string;
  commitHash: string;
  summary: string | null;
  buildNumber: number | null;
}

export interface MemberTrend {
  from: string;
  to: string;
  points: MemberDailyPoint[];
  /** 접속 집계 시작일. 기록이 하나도 없으면 null */
  activeUsersTrackedFrom: string | null;
  deployments: DeploymentMarker[];
}

/**
 * 상단 카드 숫자들.
 *
 * 비율은 서버가 주지 않습니다 — 분자·분모를 받아 화면이 계산합니다
 * (반올림 자리수를 양쪽이 각자 정하면 카드와 툴팁 숫자가 어긋납니다).
 */
export interface MemberSummary {
  totalMembers: number;
  faceRegistered: number;
  signupsLast7Days: number;
  withdrawalsLast7Days: number;
  activeToday: number;
  activeYesterday: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  /** 최근 7일 접속자 중 그 이전에도 온 적이 있는 사람 수 */
  weeklyReturningUsers: number;
  activeUsersTrackedFrom: string | null;
}

/** 기간 프리셋. 서버가 "오늘" 을 정하므로 일수만 보냅니다 */
export const TREND_RANGES = [7, 30, 90] as const;

export type TrendRange = (typeof TREND_RANGES)[number];

export const TREND_RANGE_LABEL: Record<TrendRange, string> = {
  7: '7일',
  30: '30일',
  90: '90일',
};
