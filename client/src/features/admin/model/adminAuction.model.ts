import type { BadgeProps } from '@/shared/components/ui';
import type { AdminAuctionStatus } from './adminAuction.types';

/* 배럴이 톤 유니온을 따로 내보내지 않습니다. adminTradeReview.model 과 같은 방법으로 꺼냅니다 */
type Tone = NonNullable<BadgeProps['tone']>;

/**
 * 경매 상태를 사람 말로.
 *
 * 🔴 사용자 화면(`features/auction`)과 **같은 낱말**을 씁니다 — 어드민이 "정산 중" 을 보고
 * 사용자 문의의 "정산 중" 과 같은 것인지 되짚을 수 있어야 합니다.
 */
export const AUCTION_STATUS_LABEL: Record<AdminAuctionStatus, string> = {
  ACTIVE: '진행 중',
  SETTLING: '정산 중',
  SOLD: '낙찰',
  EXPIRED: '유찰',
  CANCELLED: '취소',
};

/**
 * 상태 뱃지 색.
 *
 * `live`(붉은색)는 **진행 중**에만 씁니다 — DESIGN.md 의 예외 조항대로 상태 칩 전용이고
 * 버튼에는 쓰지 않습니다. 돈이 움직이는 중인 정산 중만 한 단계 진하게(`warning`) 두고,
 * 끝난 상태는 회색입니다 — 여기서 색을 늘리면 표에서 무엇을 먼저 봐야 하는지 알 수 없습니다.
 */
export const AUCTION_STATUS_TONE: Record<AdminAuctionStatus, Tone> = {
  ACTIVE: 'live',
  SETTLING: 'warning',
  SOLD: 'neutral',
  EXPIRED: 'quiet',
  CANCELLED: 'quiet',
};

/** 목록 필터 — '' 는 전체(필터를 걸지 않음)입니다 */
export const AUCTION_STATUS_OPTIONS: { value: AdminAuctionStatus | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'ACTIVE', label: '진행 중' },
  { value: 'SETTLING', label: '정산 중' },
  { value: 'SOLD', label: '낙찰' },
  { value: 'EXPIRED', label: '유찰' },
  { value: 'CANCELLED', label: '취소' },
];

/**
 * 진행 중인데 취소할 수 없는 경매 = **마감 대기**.
 *
 * 마감 시각이 지났는데 스위퍼가 아직 닫지 않은 상태입니다. 보통 몇 초지만, 스위퍼가
 * 멈추면 여기 오래 남습니다 — 그때 이 표시가 유일한 신호입니다.
 *
 * 🔴 시각을 비교해 판정하지 않습니다. 취소 가능 여부는 서버가 DB 시계로 정한 값이고
 * (`cancellable`), 화면이 같은 판정을 브라우저 시계로 다시 하면 둘이 어긋납니다.
 */
export function isClosingSoon(auction: {
  status: AdminAuctionStatus;
  cancellable: boolean;
}): boolean {
  return auction.status === 'ACTIVE' && !auction.cancellable;
}
