import { parseServerTime } from '@/shared/lib';
import type { AuctionDetail, AuctionStatus, MyBidResult } from './auction.types';

// (타입만 쓰는 import 라 런타임 의존이 없습니다 — model 은 React 를 모릅니다)

/**
 * 경매 정렬.
 *
 * 정렬은 **서버가** 합니다. 값은 서버 `NftAuctionSort` 와 같습니다.
 * 기본이 마감 임박순인 이유 — 경매에서 지금 봐야 하는 건 곧 끝나는 것입니다.
 * 최신순으로 두면 방금 올라와 이틀 남은 카드가 맨 위에 옵니다.
 */
export const AUCTION_SORTS = [
  { value: 'ENDING_SOON', label: '마감 임박순' },
  { value: 'CURRENT_PRICE', label: '낮은 가격순' },
  { value: 'RECENT', label: '최신 등록순' },
] as const;

export type AuctionSort = (typeof AUCTION_SORTS)[number]['value'];

export const DEFAULT_AUCTION_SORT: AuctionSort = 'ENDING_SOON';

/**
 * 판매자가 고를 수 있는 진행 시간(시간 단위).
 * 서버 허용 범위는 1시간~7일이고, 그 안에서 고르기 쉬운 값만 추립니다.
 *
 * 값이 문자열인 이유 — 공용 `Select` 가 문자열 값만 받습니다.
 * 요청에 실을 때 `Number()` 로 되돌립니다.
 */
export const DURATION_OPTIONS = [
  { value: '6', label: '6시간' },
  { value: '12', label: '12시간' },
  { value: '24', label: '1일' },
  { value: '48', label: '2일' },
  { value: '72', label: '3일' },
  { value: '168', label: '7일' },
] as const;

export type DurationOption = (typeof DURATION_OPTIONS)[number]['value'];

export const DEFAULT_DURATION_HOURS: DurationOption = '48';

/** 마감까지 남은 밀리초. 0 이면 이미 지났습니다 */
export function msUntilEnd(endsAt: string): number {
  return Math.max(0, parseServerTime(endsAt) - Date.now());
}

/** 진행 중인가 — 상태가 ACTIVE 이고 마감 시각이 아직 안 지났는가 */
export function isRunning(auction: { status: AuctionStatus; endsAt: string }): boolean {
  return auction.status === 'ACTIVE' && msUntilEnd(auction.endsAt) > 0;
}

/**
 * 남은 시간을 사람이 읽는 단위로. '2일 5시간' / '5시간 12분' / '12:30'
 *
 * `formatRemaining`(shared)은 시간·분까지만 보여줍니다. 경매는 마감 직전 초 단위가
 * 중요해서 한 시간 미만이면 분:초로 바뀝니다. 하루를 넘으면 "50시간" 대신 "2일 2시간" 입니다.
 */
export function formatTimeLeft(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  if (safe === 0) return '마감';

  const days = Math.floor(safe / 86_400);
  const hours = Math.floor((safe % 86_400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * 입찰 시각 표시. '9월 8일 14:32'
 *
 * 입찰 이력은 한 줄에 닉네임·금액·시각이 함께 들어가서
 * `formatDateTime`('2026. 9. 8. (화) 14:32')을 쓰면 시각이 줄을 다 먹습니다.
 * 연도는 뺍니다 — 경매는 길어야 이레입니다.
 */
export function formatBidTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(parseServerTime(value)));
}

/**
 * 넣을 수 있는 입찰 금액의 범위.
 * 현재가보다 **높아야** 하고, 즉시구매가가 있으면 그보다 **낮아야** 합니다
 * (즉시구매가 이상은 서버가 NFT_028 로 거절하고 즉시구매를 안내합니다).
 */
export function bidRange(auction: AuctionDetail): { min: number; max: number | null } {
  const buyNow = auction.buyNowPrice ?? null;
  return { min: auction.currentPrice + 1, max: buyNow === null ? null : buyNow - 1 };
}

/** 입찰할 수 있는 상태인가 (금액 검사는 별도) */
export function canBid(auction: AuctionDetail): boolean {
  if (!isRunning(auction)) return false;
  // 비로그인이면 viewer 가 없습니다 — 화면은 로그인 유도를 보여줍니다.
  if (!auction.viewer) return false;
  // 판매자는 자기 경매에 입찰할 수 없고, 최고 입찰자는 자기 가격을 올릴 수 없습니다.
  return !auction.viewer.isSeller && !auction.viewer.isTopBidder;
}

/** 즉시구매할 수 있는 상태인가 */
export function canBuyNow(auction: AuctionDetail): boolean {
  if (!isRunning(auction)) return false;
  if (!auction.viewer || auction.viewer.isSeller) return false;
  return (auction.buyNowPrice ?? null) !== null;
}

/** 판매자가 취소할 수 있는가 — 입찰이 하나도 없을 때만 */
export function canCancel(auction: AuctionDetail): boolean {
  return isRunning(auction) && !!auction.viewer?.isSeller && auction.bidCount === 0;
}

/** 종료된 경매의 결과 한 줄. 진행 중이면 null */
export function auctionResultText(auction: AuctionDetail): string | null {
  if (auction.status === 'SETTLING') {
    return `정산 중 · ${auction.winnerNickname ?? '낙찰자 확인 중'} · 온체인 이전을 확인하고 있어요`;
  }
  if (auction.status === 'SOLD') {
    const price = auction.finalPrice ?? auction.currentPrice;
    return `낙찰 · ${auction.winnerNickname ?? '알 수 없음'} · ${price.toLocaleString()}캣머니`;
  }
  if (auction.status === 'EXPIRED') return '유찰 · 입찰 없이 마감되었습니다';
  if (auction.status === 'CANCELLED') return '판매자가 취소한 경매입니다';
  return null;
}

/**
 * 내 경매 목록의 상태 필터.
 * 값이 빈 문자열인 "전체" 가 기본입니다 — 서버에 `status` 를 안 보내는 것과 같습니다.
 */
export const MY_AUCTION_FILTERS = [
  { value: '', label: '전체' },
  { value: 'ACTIVE', label: '진행 중' },
  { value: 'SOLD', label: '낙찰' },
  { value: 'EXPIRED', label: '유찰' },
  { value: 'CANCELLED', label: '취소' },
] as const;

export type MyAuctionFilter = (typeof MY_AUCTION_FILTERS)[number]['value'];

/** 경매 상태를 화면에 쓰는 말로. 진행 중은 카운트다운이 대신하므로 뱃지를 달지 않습니다 */
export const AUCTION_STATUS_LABEL: Record<AuctionStatus, string> = {
  ACTIVE: '진행 중',
  SETTLING: '정산 중',
  SOLD: '낙찰',
  EXPIRED: '유찰',
  CANCELLED: '취소함',
};

/** 내 입찰 결과 뱃지 문구와 톤. 붉은색은 쓰지 않습니다 — 되돌릴 수 없는 동작이 아닙니다 */
export const MY_BID_RESULT: Record<
  MyBidResult,
  { label: string; tone: 'neutral' | 'success' | 'warning' }
> = {
  BIDDING: { label: '입찰 중', tone: 'neutral' },
  OUTBID: { label: '밀림', tone: 'warning' },
  SETTLING: { label: '정산 중', tone: 'neutral' },
  WON: { label: '낙찰', tone: 'success' },
  LOST: { label: '패찰', tone: 'neutral' },
};
