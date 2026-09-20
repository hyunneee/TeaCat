import { Coins } from 'lucide-react';
import type { PhotocardDetail } from '../model/nft.types';

export function FixedPricePanel({
  listing,
  balance,
  isMine = false,
}: {
  listing: PhotocardDetail['listing'];
  balance: number;
  isMine?: boolean;
}) {
  return (
    <div className="surface-2 rounded-2xl p-4">
      <p className="text-subtle text-sm">판매가</p>
      {listing ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-1">
          <span className="text-2xl font-extrabold break-all tabular-nums">
            {listing.price.toLocaleString()}
          </span>
          <span className="text-muted font-bold">캣머니</span>
        </p>
      ) : (
        <p className="text-muted mt-1">{isMine ? '내가 보관 중인 카드입니다' : '판매 중이 아닙니다'}</p>
      )}
      {listing?.status === 'SETTLING' && (
        <p className="text-subtle mt-2 text-sm">거래 정산 중입니다. 완료되면 자동으로 갱신돼요.</p>
      )}
      <p className="text-subtle mt-2 flex items-center gap-1.5 text-sm">
        <Coins size={15} />
        사용 가능 {balance.toLocaleString()}캣머니
      </p>
    </div>
  );
}
