/**
 * 이상거래 심사 · 거래 내역 (관리자) 타입.
 *
 * 서버 계약: `server/AUCTION_FRAUD_DESIGN.md` 9장, `NftTradeReviewAdminController`.
 * 서버는 사용자 API 에서 `RISK_REVIEW` 를 `PENDING` 으로 가리지만 **관리자 API 는 그대로 준다.**
 */

export type TradeSource = 'AUCTION' | 'LISTING';

export type ReviewSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type ReviewAnalysisStatus = 'PENDING' | 'DONE' | 'FAILED' | 'SKIPPED';

export type ReviewDecision = 'APPROVED' | 'REJECTED';

/** 거래의 체인 정산 상태. 서버 `NftTradeChainStatus` 와 1:1 */
export type TradeChainStatus =
  | 'PENDING'
  | 'RISK_REVIEW'
  | 'CAT_SUBMITTED'
  | 'CAT_CONFIRMED'
  | 'NFT_SUBMITTED'
  | 'COMPLETED'
  | 'COMPENSATING'
  | 'REFUND_SUBMITTED'
  | 'COMPENSATED'
  | 'FAILED'
  | 'MANUAL_REVIEW';

/** 규칙 하나가 낸 신호. evidence 는 숫자·불리언·내부 id 만 담는다 (서버가 개인정보를 넣지 않는다) */
export interface TradeRiskSignal {
  rule: string;
  severity: ReviewSeverity;
  evidence: Record<string, unknown>;
}

export interface TradeReviewParty {
  userId: number;
  nickname: string;
  /** 최근 90일 심사에 등장한 횟수 (이 건 포함) */
  reviewAppearances90d: number;
}

export interface TradeReviewSummary {
  reviewId: number;
  tradeId: number;
  source: TradeSource;
  auctionId: number | null;
  listingId: number | null;
  photocardId: number;
  designName: string;
  imageUrl: string;
  price: number;
  tradeStatus: TradeChainStatus;
  maxSeverity: ReviewSeverity;
  /** 보류 기준(HIGH 1개 또는 MEDIUM 2개)을 넘었나. 신호가 하나만 있어도 행은 남는다 */
  flagged: boolean;
  /** 정산을 실제로 멈췄나(HOLD 모드). false 면 거래는 이미 정산됐고 결정은 판정 기록이다 */
  held: boolean;
  rules: string[];
  analysisStatus: ReviewAnalysisStatus;
  headline: string | null;
  createdAt: string;
  /** 이 시각까지 결정이 없으면 자동 승인. 결정이 났으면 null */
  autoApproveAt: string | null;
  decision: ReviewDecision | null;
  decidedAt: string | null;
  autoApproved: boolean;
  seller: TradeReviewParty;
  buyer: TradeReviewParty;
}

export interface TradeReviewPartyDetail {
  userId: number;
  nickname: string;
  email: string;
  createdAt: string;
  reviewAppearances90d: number;
  /** 이 거래 요청 단말의 IP. 모르면 null */
  ip: string | null;
}

export interface TradeReviewBid {
  bidId: number;
  bidderId: number;
  bidderNickname: string;
  amount: number;
  createdAt: string;
  sameIpAsSeller: boolean | null;
  sameDeviceAsSeller: boolean | null;
}

export interface TradeReviewRecentTrade {
  tradeId: number;
  price: number;
  completedAt: string;
  involvesParties: boolean;
}

export interface TradeReviewDetail {
  summary: TradeReviewSummary;
  signals: TradeRiskSignal[];
  /** AI 분석 보고서(설계 7-3). 아직 없으면 null */
  analysis: Record<string, unknown> | null;
  analysisModel: string | null;
  /** 섀도우 모델의 판단과 근거 */
  model: ModelInsight;
  decidedBy: number | null;
  decisionNote: string | null;
  sameIp: boolean | null;
  sameUserAgent: boolean | null;
  seller: TradeReviewPartyDetail;
  buyer: TradeReviewPartyDetail;
  bids: TradeReviewBid[];
  recentDesignTrades: TradeReviewRecentTrade[];
}

export interface TradeReviewPage {
  reviews: TradeReviewSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface TradeReviewStats {
  windowDays: number;
  trades: number;
  reviews: number;
  open: number;
  approved: number;
  rejected: number;
  autoApproved: number;
  ruleHits: Record<string, number>;
}

/** 전체 거래 내역의 한 줄. 심사에 걸린 적이 있으면 review* 가 채워진다 */
export interface AdminTrade {
  tradeId: number;
  source: TradeSource;
  auctionId: number | null;
  listingId: number | null;
  photocardId: number;
  designName: string;
  imageUrl: string;
  sellerId: number;
  sellerNickname: string;
  buyerId: number;
  buyerNickname: string;
  price: number;
  chainStatus: TradeChainStatus;
  failureCode: string | null;
  createdAt: string;
  completedAt: string | null;
  reviewId: number | null;
  reviewDecision: ReviewDecision | null;
  reviewSeverity: ReviewSeverity | null;
  /** 심사가 정산을 실제로 멈췄나. 심사 없으면 null */
  reviewHeld: boolean | null;
  /**
   * 섀도우 모델의 부정 확률 0~1. 규칙과 달리 모든 거래에 붙습니다.
   * 🔴 아무 결정도 하지 않습니다 — 관리자 참고용입니다.
   * 모델이 없던 시점의 거래이거나 학습 범위 밖이면 null 입니다.
   */
  modelScore: number | null;
}

/** 피처 하나가 이 점수에 보탠 몫. 양수면 부정 쪽, 음수면 정상 쪽으로 민 것 */
export interface ModelFactor {
  label: string;
  contribution: number;
}

/**
 * 섀도우 모델의 판단과 근거.
 *
 * 로지스틱 회귀라 점수가 각 피처 기여의 단순 합이라, "왜 이 점수인가" 를 계산으로 답할 수 있습니다.
 * 채점 당시와 지금 모델이 다르면(staleModel) 근거를 보여주지 않습니다 — 맞지 않는 설명보다 없는 편이 낫습니다.
 */
export interface ModelInsight {
  score: number | null;
  version: string | null;
  staleModel: boolean;
  explanation: ModelFactor[];
}

export interface AdminTradePage {
  trades: AdminTrade[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** 심사 목록 탭 — 서버 `ListStatus` */
export type ReviewListStatus = 'OPEN' | 'DECIDED';

/** 거래 내역 필터 — 서버 `TradeFilter`. 체인 상태 열 개를 네 묶음으로 접은 것 */
export type TradeFilter = 'ALL' | 'REVIEW' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface AdminTradeReviewQuery {
  status: ReviewListStatus;
  page: number;
  size: number;
}

export interface AdminTradeQuery {
  status: TradeFilter;
  page: number;
  size: number;
}
