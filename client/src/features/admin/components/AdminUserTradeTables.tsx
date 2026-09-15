import { SectionTitle } from '@/shared/components/ui';
import { formatDateTime, formatPrice } from '@/shared/lib';
import type { PurchaseHistory, SaleHistory } from '@/features/nft';
import { AdminRecordTable } from './AdminRecordTable';

/**
 * 회원 상세 — 포카 거래 탭 (구매 · 판매).
 *
 * 🔴 <b>보유 목록과 다릅니다.</b> 여기는 "체결된 거래" 라, 샀다가 되판 카드도 양쪽에 남습니다.
 * 지금 무엇을 가지고 있는지는 보유 탭이 답합니다.
 *
 * 두 표를 <b>세로로 쌓습니다.</b> 탭 안에 또 탭을 두면 지금 어디를 보고 있는지 헷갈리고,
 * 어드민은 화면이 넓어 둘 다 펼쳐도 답답하지 않습니다.
 */
export interface AdminUserTradeTablesProps {
  purchases: {
    items: PurchaseHistory[];
    isLoading: boolean;
    hasMore: boolean;
    isLoadingMore: boolean;
    onMore: () => void;
  };
  sales: {
    items: SaleHistory[];
    isLoading: boolean;
    hasMore: boolean;
    isLoadingMore: boolean;
    onMore: () => void;
  };
}

const PURCHASE_HEADERS = ['카드', '판매자', '금액', '체결일'] as const;
const SALE_HEADERS = ['카드', '구매자', '금액', '체결일'] as const;

export function AdminUserTradeTables({ purchases, sales }: AdminUserTradeTablesProps) {
  return (
    <div className="flex flex-col gap-2">
      <section>
        <SectionTitle>구매 내역</SectionTitle>
        <AdminRecordTable
          headers={PURCHASE_HEADERS}
          isLoading={purchases.isLoading}
          isEmpty={purchases.items.length === 0}
          emptyTitle="포토카드를 구매한 적이 없어요"
          hasMore={purchases.hasMore}
          isLoadingMore={purchases.isLoadingMore}
          onMore={purchases.onMore}
        >
          {purchases.items.map((trade) => (
            <TradeRow
              key={trade.tradeId}
              designName={trade.designName}
              imageUrl={trade.imageUrl}
              counterpart={trade.sellerNickname}
              price={trade.price}
              tradedAt={trade.tradedAt}
            />
          ))}
        </AdminRecordTable>
      </section>

      <section>
        <SectionTitle>판매 내역</SectionTitle>
        <AdminRecordTable
          headers={SALE_HEADERS}
          isLoading={sales.isLoading}
          isEmpty={sales.items.length === 0}
          emptyTitle="포토카드를 판매한 적이 없어요"
          hasMore={sales.hasMore}
          isLoadingMore={sales.isLoadingMore}
          onMore={sales.onMore}
        >
          {sales.items.map((trade) => (
            <TradeRow
              key={trade.tradeId}
              designName={trade.designName}
              imageUrl={trade.imageUrl}
              counterpart={trade.buyerNickname}
              price={trade.price}
              tradedAt={trade.tradedAt}
            />
          ))}
        </AdminRecordTable>
      </section>
    </div>
  );
}

/** 구매·판매가 상대방 이름만 다르고 나머지가 같아서 한 줄로 묶습니다 */
function TradeRow({
  designName,
  imageUrl,
  counterpart,
  price,
  tradedAt,
}: {
  designName: string;
  imageUrl: string | null;
  counterpart: string;
  price: number;
  tradedAt: string;
}) {
  return (
    <tr className="border-line/60 hover:bg-surface-2 border-b last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="bg-surface-2 h-10 w-7.5 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="bg-surface-2 h-10 w-7.5 shrink-0 rounded" aria-hidden />
          )}
          <p className="text-ink font-medium">{designName}</p>
        </div>
      </td>
      <td className="text-ink px-4 py-3">{counterpart}</td>
      <td className="text-ink px-4 py-3 tabular-nums">{formatPrice(price)}</td>
      <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">{formatDateTime(tradedAt)}</td>
    </tr>
  );
}
