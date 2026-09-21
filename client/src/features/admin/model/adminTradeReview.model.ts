import type { BadgeProps } from '@/shared/components/ui';
import type {
  ReviewDecision,
  ReviewSeverity,
  TradeChainStatus,
  TradeFilter,
  TradeSource,
} from './adminTradeReview.types';

type Tone = NonNullable<BadgeProps['tone']>;

/**
 * 이상거래 심사 화면의 순수 규칙 — 라벨·톤·근거 표기.
 *
 * React 를 모릅니다 (CLAUDE.md 2장 model). 규칙 코드는 서버와 약속된 문자열이라 여기서만 한글로 바꿉니다.
 */

/** 규칙 코드 → 한 줄 이름. 서버 `TradeRisk*Rule.CODE` 와 1:1 */
export const RULE_LABEL: Record<string, string> = {
  R1_SAME_DEVICE: '동일 단말',
  R2_SAME_PHONE: '동일 전화번호',
  R3_REPEATED_PAIR: '반복 거래쌍 · 순환',
  R4_PRICE_OUTLIER: '시세 이상',
  R5_NEW_ACCOUNT_RUSH: '신규 계정 급행',
  R6_VOLUME_SPIKE: '거래량 집중',
  R7_HOARDING: '매집',
  R8_ACCOUNT_TAKEOVER: '계정 탈취 의심',
};

/** 규칙이 무엇을 보는지 — 관리자가 근거를 읽을 때 옆에 붙는 설명 */
export const RULE_DESCRIPTION: Record<string, string> = {
  R1_SAME_DEVICE: '판매자의 등록 요청과 구매자(또는 2위 입찰자)의 요청이 같은 IP 에서 왔습니다. UA 까지 같으면 같은 브라우저입니다.',
  R2_SAME_PHONE: '판매자와 구매자(또는 2위 입찰자)의 전화번호가 같습니다. 한 사람이 만든 여러 계정일 수 있습니다.',
  R3_REPEATED_PAIR: '같은 두 계정이 최근에 반복해서 거래했거나, 같은 카드가 두 계정 사이를 되돌아왔습니다.',
  R4_PRICE_OUTLIER: '거래가가 같은 도안의 최근 거래가 중앙값보다 크게 높습니다.',
  R5_NEW_ACCOUNT_RUSH: '가입 직후 계정이 첫 충전 직후 바로 돈을 걸었습니다.',
  R6_VOLUME_SPIKE: '같은 도안의 거래가 최근 갑자기 몰렸고, 그 거래의 절반 이상에 이 거래의 당사자가 끼어 있습니다.',
  R7_HOARDING: '구매자가 이 도안을 쓸어 모으고 있습니다.',
  R8_ACCOUNT_TAKEOVER: '다른 단말 이력이 있는 계정이 처음 보는 단말에서 로그인한 직후 평소보다 큰 금액을 썼습니다.',
};

export function ruleLabel(rule: string): string {
  return RULE_LABEL[rule] ?? rule;
}

export const SEVERITY_LABEL: Record<ReviewSeverity, string> = {
  LOW: '낮음',
  MEDIUM: '중간',
  HIGH: '높음',
};

/** 무게는 색으로 읽힙니다 — HIGH 만 붉게. 붉은색은 "조심하세요" 신호라 여기서는 위험 표시가 맞습니다 */
export const SEVERITY_TONE: Record<ReviewSeverity, Tone> = {
  LOW: 'quiet',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export const SOURCE_LABEL: Record<TradeSource, string> = {
  AUCTION: '경매',
  LISTING: '고정가',
};

/** 정산을 멈춘(held) 심사의 결정 — 돈이 움직인다 */
export const DECISION_LABEL: Record<ReviewDecision, string> = {
  APPROVED: '승인',
  REJECTED: '거절',
};

/** 표시만 된 심사의 결정 — 거래는 이미 정산됐고 판정 기록(학습 라벨)이다 */
export const VERDICT_LABEL: Record<ReviewDecision, string> = {
  APPROVED: '정상',
  REJECTED: '부정',
};

/** 같은 enum 이지만 뜻이 다르다 — 보류였으면 승인·거절, 표시만이었으면 정상·부정 */
export function decisionLabel(decision: ReviewDecision, held: boolean | null): string {
  return held ? DECISION_LABEL[decision] : VERDICT_LABEL[decision];
}

export const DECISION_TONE: Record<ReviewDecision, Tone> = {
  APPROVED: 'success',
  REJECTED: 'danger',
};

/** 체인 정산 상태 → 관리자용 표기. 사용자 화면과 달리 심사 보류·거절도 숨기지 않습니다 */
export const CHAIN_STATUS_LABEL: Record<TradeChainStatus, string> = {
  PENDING: '정산 대기',
  RISK_REVIEW: '심사 대기',
  CAT_SUBMITTED: '캣머니 전송 중',
  CAT_CONFIRMED: '카드 전송 대기',
  NFT_SUBMITTED: '카드 전송 중',
  COMPLETED: '완료',
  COMPENSATING: '환불 중',
  REFUND_SUBMITTED: '환불 전송 중',
  COMPENSATED: '환불 완료',
  FAILED: '실패',
  MANUAL_REVIEW: '운영 확인 필요',
};

export const CHAIN_STATUS_TONE: Record<TradeChainStatus, Tone> = {
  PENDING: 'quiet',
  RISK_REVIEW: 'warning',
  CAT_SUBMITTED: 'info',
  CAT_CONFIRMED: 'info',
  NFT_SUBMITTED: 'info',
  COMPLETED: 'success',
  COMPENSATING: 'warning',
  REFUND_SUBMITTED: 'warning',
  COMPENSATED: 'neutral',
  FAILED: 'danger',
  MANUAL_REVIEW: 'danger',
};

export const TRADE_FILTER_OPTIONS: { value: TradeFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'REVIEW', label: '심사 대기' },
  { value: 'IN_PROGRESS', label: '정산 중' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'FAILED', label: '실패' },
];

/** 실패 사유 코드 중 사람이 읽을 이름이 있는 것. 나머지는 코드 그대로 */
export const FAILURE_CODE_LABEL: Record<string, string> = {
  RISK_REJECTED: '심사 거절',
  INSUFFICIENT_BALANCE: '잔액 부족',
  CHAIN_UNAVAILABLE: '체인 연결 불가',
  BLOCKCHAIN_NOT_CONFIGURED: '체인 미설정',
};

export function failureLabel(code: string | null): string | null {
  if (!code) return null;
  return FAILURE_CODE_LABEL[code] ?? code;
}

/** 근거(evidence) 키 → 한글. 서버가 넣는 키 이름과 1:1. 없는 키는 그대로 보입니다 */
const EVIDENCE_LABEL: Record<string, string> = {
  counterpart: '상대',
  counterpartUserId: '상대 회원 ID',
  ipMatch: 'IP 일치',
  userAgentMatch: 'UA 일치',
  phoneMatch: '전화번호 일치',
  photocardCycled: '카드 순환',
  photocardId: '카드 ID',
  pairTrades: '두 계정 거래 수',
  threshold: '기준',
  windowDays: '기간(일)',
  price: '거래가',
  medianPrice: '최근 중앙값',
  samples: '표본 수',
  ratio: '배율',
  accountAgeMinutes: '가입 후(분)',
  minutesSinceFirstDeposit: '첫 충전 후(분)',
  newAccountAgeHours: '신규 기준(시간)',
  depositToBidMinutes: '충전→구매 기준(분)',
  recentTrades: '최근 거래 수',
  recentTradesWithParties: '당사자 낀 거래 수',
  baselineWeeklyAverage: '이전 주평균',
  designId: '도안 ID',
  issuedSupply: '발행량',
  ownedAfterTrade: '거래 후 보유',
  ownedShareAfter: '거래 후 보유 비율',
  bySupplyShare: '보유 비율로 적중',
  designTradesInWindow: '최근 도안 거래 수',
  buyerBuysInWindow: '구매자 매수 수',
  buyShareAfter: '매수 비율',
  byBuyShare: '매수 비율로 적중',
  newDevice: '새 단말',
  priorDeviceLogins: '다른 단말 로그인 수',
  minutesSinceDeviceFirstLogin: '단말 첫 로그인 후(분)',
  recentMaxSpend: '최근 최대 지출',
};

const COUNTERPART_LABEL: Record<string, string> = {
  buyer: '구매자',
  runnerUp: '2위 입찰자',
};

export function evidenceLabel(key: string): string {
  return EVIDENCE_LABEL[key] ?? key;
}

export function formatEvidenceValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '없음';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (key === 'counterpart' && typeof value === 'string') return COUNTERPART_LABEL[value] ?? value;
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  return String(value);
}

/** 근거 항목을 표시 순서대로 — 무엇에 걸렸는지(불리언)가 먼저, 수치가 뒤 */
export function evidenceEntries(evidence: Record<string, unknown>): [string, unknown][] {
  return Object.entries(evidence).sort(([, a], [, b]) => {
    const rank = (v: unknown) => (typeof v === 'boolean' ? 0 : typeof v === 'string' ? 1 : 2);
    return rank(a) - rank(b);
  });
}

/** 자동 승인까지 남은 시간. 지났으면 '곧 자동 승인' */
export function remainingUntil(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return '곧 자동 승인';
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}일 ${hours % 24}시간 남음`;
  if (hours >= 1) return `${hours}시간 남음`;
  return `${Math.max(1, Math.floor(diff / 60_000))}분 남음`;
}
