import { useState } from 'react';
import { Minus, Plus, Ticket } from 'lucide-react';
import { IconButton } from '@/shared/components/ui';

interface Props {
  availableSeats: number;
  maxPerUser: number;
  price: number;
}

/**
 * 다매 스탠딩 홀드를 지원할 때 다시 연결할 수량 선택 UI.
 *
 * 현재는 구역 클릭 즉시 1매를 자동 선점하므로 의도적으로 렌더링하지 않는다. 이후 서버의
 * 회차당 1인 1매 제약과 결제 모델을 다매 구조로 변경할 때 이 컴포넌트를 연결하면 된다.
 */
export function StandingQuantitySelector({ availableSeats, maxPerUser, price }: Props) {
  const limit = Math.max(1, Math.min(maxPerUser, availableSeats));
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="surface w-full max-w-md rounded-2xl p-6 text-center shadow-sm">
      <Ticket size={40} className="text-accent-700 mx-auto" aria-hidden />
      <h2 className="text-ink mt-3 text-lg font-bold">스탠딩 입장권</h2>
      <p className="text-ink-muted mt-1 text-sm">
        지정된 위치 없이 입장하는 구역입니다. 현재 {availableSeats.toLocaleString()}매 남아 있어요.
      </p>

      <div className="surface-2 mt-5 rounded-2xl p-4">
        <p className="text-ink-muted text-sm font-medium">구매 수량</p>
        <div className="mt-3 flex items-center justify-center gap-5">
          <IconButton
            label="스탠딩 입장권 수량 줄이기"
            variant="secondary"
            disabled={quantity <= 1}
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
          >
            <Minus size={18} />
          </IconButton>
          <span className="text-ink min-w-16 text-2xl font-bold" aria-live="polite">
            {quantity}
            <span className="ml-1 text-sm font-medium">매</span>
          </span>
          <IconButton
            label="스탠딩 입장권 수량 늘리기"
            variant="secondary"
            disabled={quantity >= limit}
            onClick={() => setQuantity((current) => Math.min(limit, current + 1))}
          >
            <Plus size={18} />
          </IconButton>
        </div>
        <div className="border-line mt-4 flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-ink-muted">총 금액</span>
          <strong className="text-ink">{(price * quantity).toLocaleString('ko-KR')}원</strong>
        </div>
      </div>
    </div>
  );
}
