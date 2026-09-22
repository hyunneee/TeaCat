import { useEffect, useState, type ReactNode } from 'react';
import { Gavel, Info } from 'lucide-react';
import { Badge, Button, Modal, Skeleton, Textarea } from '@/shared/components/ui';
import { formatDateTime, formatPrice } from '@/shared/lib';
import {
  AUCTION_STATUS_LABEL,
  AUCTION_STATUS_TONE,
  isClosingSoon,
} from '../model/adminAuction.model';
import type { AdminAuctionDetail } from '../model/adminAuction.types';

/**
 * 경매 상세 · 강제 취소.
 *
 * 서버를 모릅니다 — 요청은 전부 콜백으로 위로 올립니다 (CLAUDE.md 4-3).
 *
 * 🔴 강제 취소는 **되돌릴 수 없는 동작**이라 붉은 버튼이고(4-7), 사유가 비어 있으면
 *    잠깁니다 — 서버도 400 으로 막지만 눌렀을 때 실패하는 버튼을 보여주지 않으려고
 *    화면에서도 잠급니다. 최종 확인은 페이지의 `ConfirmModal` 이 받습니다.
 *
 * 🔴 취소할 수 있는지는 **서버가 준 `cancellable`** 만 봅니다. 화면에서 시각을 비교하면
 *    어드민 브라우저 시계가 서버와 다를 때 어긋납니다.
 */
export interface AdminAuctionDetailModalProps {
  detail: AdminAuctionDetail | undefined;
  isLoading: boolean;
  cancelling: boolean;
  onClose: () => void;
  /** 사유는 비어 있지 않은 문자열로만 올라옵니다 */
  onCancel: (reason: string) => void;
}

const REASON_MAX = 200;

/** 이름 : 값 한 줄 — 상세에 같은 모양이 열 줄 넘게 들어갑니다 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-line/60 flex items-baseline justify-between gap-3 border-b py-2 last:border-0">
      <span className="text-ink-muted shrink-0 text-xs">{label}</span>
      <span className="text-ink min-w-0 truncate text-right text-sm">{children}</span>
    </div>
  );
}

export function AdminAuctionDetailModal({
  detail,
  isLoading,
  cancelling,
  onClose,
  onCancel,
}: AdminAuctionDetailModalProps) {
  const [reason, setReason] = useState('');

  /* 다른 경매를 열면 사유 입력을 비웁니다 — 앞 경매에 적던 사유가 남아 있으면
     그대로 눌러 엉뚱한 사유가 기록됩니다 */
  useEffect(() => {
    setReason('');
  }, [detail?.auction.auctionId]);

  const auction = detail?.auction;
  const canCancel = Boolean(auction?.cancellable);

  return (
    <Modal
      open
      onClose={onClose}
      variant="center"
      width="wide"
      title={auction ? `경매 #${auction.auctionId} · ${auction.designName}` : '경매 상세'}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-ink-muted text-xs">
            {auction && !canCancel && auction.status === 'ACTIVE' && (
              <span>마감 시각이 지나 정산을 기다리는 중이에요. 마감 뒤에는 거래 심사에서 처리해요.</span>
            )}
            {auction && !canCancel && auction.status !== 'ACTIVE' && (
              <span>이미 끝난 경매예요. 취소할 수 없어요.</span>
            )}
            {canCancel && <span>취소하면 입찰자의 캣머니 담보가 풀려요.</span>}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
            <Button
              variant="danger"
              disabled={!canCancel || reason.trim().length === 0}
              loading={cancelling}
              onClick={() => onCancel(reason.trim())}
            >
              강제 취소
            </Button>
          </div>
        </div>
      }
    >
      {isLoading || !auction || !detail ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge tone={AUCTION_STATUS_TONE[auction.status]} size="md">
              {AUCTION_STATUS_LABEL[auction.status]}
            </Badge>
            {isClosingSoon(auction) && (
              <Badge tone="warning">마감 대기</Badge>
            )}
            <span className="text-ink-muted inline-flex items-center gap-1 text-sm">
              <Gavel size={13} />
              입찰 {auction.bidCount}회
            </span>
          </div>

          <div>
            <Row label="카드">
              {auction.designName} (#{auction.photocardId})
            </Row>
            <Row label="출처">
              {auction.performanceTitle ?? '이벤트 카드팩'}
            </Row>
            <Row label="판매자">
              {auction.sellerNickname} (회원 #{detail.sellerId})
            </Row>
            <Row label="최고 입찰자">
              {detail.topBidderNickname === null
                ? '없음'
                : `${detail.topBidderNickname} (회원 #${detail.topBidderId})`}
            </Row>
            <Row label="낙찰자">{auction.winnerNickname ?? '—'}</Row>
            <Row label="시작가">{formatPrice(auction.startPrice)}</Row>
            <Row label="현재가">{formatPrice(auction.currentPrice)}</Row>
            <Row label="즉시구매가">
              {auction.buyNowPrice === null ? '없음' : formatPrice(auction.buyNowPrice)}
            </Row>
            <Row label="등록">{formatDateTime(auction.createdAt)}</Row>
            <Row label="마감">{formatDateTime(auction.endsAt)}</Row>
            <Row label="닫힌 시각">
              {auction.closedAt === null ? '—' : formatDateTime(auction.closedAt)}
            </Row>
          </div>

          <div>
            <p className="text-ink mb-2 text-sm font-bold">입찰 이력</p>
            {detail.bids.length === 0 ? (
              <p className="text-ink-muted text-sm">아직 입찰이 없어요.</p>
            ) : (
              <ul className="surface-2 max-h-56 overflow-y-auto rounded-xl px-3">
                {detail.bids.map((bid) => (
                  <li
                    key={bid.bidId}
                    className="border-line/60 flex items-baseline justify-between gap-3 border-b py-2 last:border-0"
                  >
                    <span className="text-ink min-w-0 truncate text-sm">{bid.bidderNickname}</span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <span className="text-ink text-sm font-bold tabular-nums">
                        {formatPrice(bid.amount)}
                      </span>
                      <span className="text-ink-muted text-xs">{formatDateTime(bid.bidAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canCancel && (
            <div className="flex flex-col gap-2">
              <Textarea
                label="취소 사유"
                showRequirement
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
                placeholder="예: 판매자 사칭 신고 접수 (#1234)"
                hint={`${reason.length}/${REASON_MAX}자`}
                rows={2}
              />
              {/* ⚠️ 사용자 결정으로 사유를 DB 에 남기지 않습니다. 화면에 그대로 적어 둡니다 —
                  적지 않으면 나중에 "지난 취소 사유 어디서 보냐" 가 버그로 접수됩니다. */}
              <p className="text-ink-subtle flex items-start gap-1.5 text-xs">
                <Info size={13} className="mt-0.5 shrink-0" />
                사유는 서버 기록(로그)에만 남아요. 이 화면에서 지난 취소 사유를 다시 볼 수는 없어요.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
