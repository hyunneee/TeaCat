import { Badge, Button, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { formatDateTime, formatPrice } from '@/shared/lib';
import {
  AUCTION_STATUS_LABEL,
  AUCTION_STATUS_TONE,
  isClosingSoon,
} from '../model/adminAuction.model';
import type { AdminAuction } from '../model/adminAuction.types';

/**
 * 어드민 경매 표.
 *
 * 서버를 모릅니다 — props 로 받은 것만 그립니다 (CLAUDE.md 4-3).
 * 정렬은 서버가 합니다(최근 등록순).
 */
export interface AdminAuctionTableProps {
  auctions: AdminAuction[];
  isLoading: boolean;
  /** 🔴 실패를 빈 목록으로 그리면 "경매가 없다" 로 읽힙니다 */
  isError?: boolean;
  /** 필터가 걸려 있으면 빈 문구를 다르게 적습니다 — "아직 경매가 없다" 와 다릅니다 */
  filtered: boolean;
  selectedId: number | null;
  onSelect: (auctionId: number) => void;
}

const HEADERS = [
  '상태',
  '카드',
  '판매자',
  '입찰',
  '현재가',
  '즉시구매가',
  '마감',
  '낙찰자',
  '',
] as const;

export function AdminAuctionTable({
  auctions,
  isLoading,
  isError,
  filtered,
  selectedId,
  onSelect,
}: AdminAuctionTableProps) {
  if (isError) {
    return (
      <EmptyState
        title="경매 목록을 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요. 계속 실패하면 서버 로그를 확인해야 해요."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (auctions.length === 0) {
    return (
      <EmptyState
        title={filtered ? '조건에 맞는 경매가 없어요' : '아직 등록된 경매가 없어요'}
        description={
          filtered
            ? '상태나 검색어를 바꿔 보세요.'
            : '사용자가 포토카드를 경매로 올리면 여기에 쌓여요.'
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-4xl border-collapse text-sm">
        <thead>
          <tr className="border-line border-b text-left">
            {HEADERS.map((header, i) => (
              <th
                key={header || `col-${i}`}
                scope="col"
                className="text-ink-muted px-4 py-2.5 text-xs font-medium"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {auctions.map((auction) => (
            <tr
              key={auction.auctionId}
              className={
                auction.auctionId === selectedId
                  ? 'border-line/60 bg-surface-2 border-b last:border-0'
                  : 'border-line/60 hover:bg-surface-2 border-b last:border-0'
              }
            >
              <td className="px-4 py-3">
                <div className="flex flex-col items-start gap-1">
                  <Badge tone={AUCTION_STATUS_TONE[auction.status]}>
                    {AUCTION_STATUS_LABEL[auction.status]}
                  </Badge>
                  {/* 🔴 스위퍼가 멈추면 이 표시가 유일한 신호입니다 (isClosingSoon 주석) */}
                  {isClosingSoon(auction) && (
                    <span
                      className="text-ink-subtle text-xs"
                      title="마감 시각이 지났지만 아직 닫히지 않았어요. 잠시 뒤 낙찰 또는 유찰로 바뀝니다."
                    >
                      마감 대기
                    </span>
                  )}
                </div>
              </td>

              <td className="max-w-xs px-4 py-3">
                <p className="text-ink truncate font-medium">{auction.designName}</p>
                <p className="text-ink-muted text-xs">
                  카드 #{auction.photocardId}
                  {auction.performanceTitle ? ` · ${auction.performanceTitle}` : ' · 이벤트 카드팩'}
                </p>
              </td>

              <td className="text-ink px-4 py-3">{auction.sellerNickname}</td>

              <td className="text-ink px-4 py-3 tabular-nums">{auction.bidCount}</td>

              <td className="px-4 py-3">
                <p className="text-ink font-medium tabular-nums">{formatPrice(auction.currentPrice)}</p>
                {/* 시작가를 같이 보여 줍니다 — 현재가만 보면 값이 오른 것인지 알 수 없습니다 */}
                <p className="text-ink-muted text-xs tabular-nums">
                  시작 {formatPrice(auction.startPrice)}
                </p>
              </td>

              <td className="text-ink-muted px-4 py-3 tabular-nums">
                {auction.buyNowPrice === null ? '—' : formatPrice(auction.buyNowPrice)}
              </td>

              <td className="text-ink-muted px-4 py-3 text-xs">{formatDateTime(auction.endsAt)}</td>

              <td className="text-ink px-4 py-3">{auction.winnerNickname ?? '—'}</td>

              <td className="px-4 py-3 text-right">
                <Button variant="soft" size="sm" onClick={() => onSelect(auction.auctionId)}>
                  자세히
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
