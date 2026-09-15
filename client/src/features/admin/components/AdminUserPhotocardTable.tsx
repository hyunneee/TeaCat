import { Badge } from '@/shared/components/ui';
import type { MyPhotocard } from '@/features/nft';
import { AdminRecordTable } from './AdminRecordTable';

/**
 * 회원 상세 — 보유 포카 탭.
 *
 * 🔴 <b>"지금 가지고 있는 것"</b>입니다. 판매 등록 중인 카드도 아직 본인 소유라 함께 나옵니다
 * (칩으로 구분). 샀다가 되판 카드는 여기 없고 거래 탭에 있습니다.
 *
 * 발행 상태가 `PENDING`/`MINTING` 이어도 카드는 이미 그 사람 것입니다 — 체인 확정에 10초쯤
 * 걸릴 뿐이라 실패처럼 보여주지 않습니다.
 */
export interface AdminUserPhotocardTableProps {
  photocards: MyPhotocard[];
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onMore: () => void;
}

const HEADERS = ['카드', '출처', '발행 상태', '판매'] as const;

/* Record 로 적어두면 서버가 상태를 늘렸을 때 **컴파일이 깨져서** 알려줍니다 */
const MINT_LABEL: Record<MyPhotocard['status'], string> = {
  PENDING: '발행 중',
  MINTING: '발행 중',
  MINTED: '발행 완료',
  FAILED: '발행 실패',
};

export function AdminUserPhotocardTable({
  photocards,
  isLoading,
  hasMore,
  isLoadingMore,
  onMore,
}: AdminUserPhotocardTableProps) {
  return (
    <AdminRecordTable
      headers={HEADERS}
      isLoading={isLoading}
      isEmpty={photocards.length === 0}
      emptyTitle="가지고 있는 포토카드가 없어요"
      emptyDescription="공연 관람이나 카드팩으로 얻으면 여기에 보입니다."
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onMore={onMore}
    >
      {photocards.map((card) => (
        <tr
          key={card.photocardId}
          className="border-line/60 hover:bg-surface-2 border-b last:border-0"
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              {/* 카드 그림이 없을 수도 있습니다. 빈 칸을 두면 줄마다 높이가 달라집니다 */}
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt=""
                  className="bg-surface-2 h-12 w-9 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="bg-surface-2 h-12 w-9 shrink-0 rounded" aria-hidden />
              )}
              <p className="text-ink font-medium">{card.designName}</p>
            </div>
          </td>

          {/* 🔴 뽑기로 얻은 카드는 공연이 null 입니다 — 좌석에서 나온 게 아닙니다 */}
          <td className="text-ink-muted px-4 py-3 text-xs">
            {card.performanceTitle ?? '이벤트 카드팩'}
          </td>

          <td className="text-ink-muted px-4 py-3 text-xs">{MINT_LABEL[card.status]}</td>

          <td className="px-4 py-3">
            {card.listed ? (
              <Badge tone="accent">판매 중</Badge>
            ) : (
              <span className="text-ink-subtle text-xs">—</span>
            )}
          </td>
        </tr>
      ))}
    </AdminRecordTable>
  );
}
