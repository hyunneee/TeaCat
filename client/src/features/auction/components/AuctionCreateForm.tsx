import { useState } from 'react';
import { Coins, Zap } from 'lucide-react';
import { Button, Input, Select } from '@/shared/components/ui';
import {
  DEFAULT_DURATION_HOURS,
  DURATION_OPTIONS,
  type DurationOption,
} from '../model/auction.model';

interface Props {
  onSubmit: (values: { startPrice: number; buyNowPrice?: number; durationHours: number }) => void;
  isPending?: boolean;
}

/**
 * 경매 등록 폼.
 *
 * 세 가지만 정합니다 — 얼마부터 / (선택) 얼마면 바로 / 언제까지.
 * 예약가나 호가 단위는 두지 않습니다. 시작가가 이미 공개 최저선이고,
 * 규칙이 늘수록 파는 사람이 무엇을 정해야 하는지 알 수 없어집니다.
 *
 * 막을 수 있는 건 여기서 막습니다(즉시구매가 ≤ 시작가). 서버도 다시 검사합니다 —
 * 프론트 검증은 사용자를 돕는 것이고, **판정은 언제나 서버**입니다.
 */
export function AuctionCreateForm({ onSubmit, isPending }: Props) {
  const [startPrice, setStartPrice] = useState('');
  const [buyNowPrice, setBuyNowPrice] = useState('');
  const [durationHours, setDurationHours] = useState<DurationOption>(DEFAULT_DURATION_HOURS);

  const start = Number(startPrice);
  const buyNow = Number(buyNowPrice);
  const hasBuyNow = buyNowPrice.length > 0;

  const buyNowError =
    hasBuyNow && buyNow > 0 && start > 0 && buyNow <= start
      ? '즉시구매가는 시작가보다 높아야 해요.'
      : null;

  const canSubmit = start > 0 && !buyNowError && (!hasBuyNow || buyNow > 0);

  const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 9);

  return (
    <div className="space-y-3">
      <Input
        label="시작가"
        showRequirement
        required
        value={startPrice}
        onChange={(e) => setStartPrice(onlyDigits(e.target.value))}
        placeholder="캣머니 개수"
        inputMode="numeric"
        leftIcon={<Coins size={16} />}
        hint="이 금액부터 입찰이 시작돼요."
      />

      <Input
        label="즉시구매가"
        showRequirement
        value={buyNowPrice}
        onChange={(e) => setBuyNowPrice(onlyDigits(e.target.value))}
        placeholder="비워두면 경매로만 팔려요"
        inputMode="numeric"
        leftIcon={<Zap size={16} />}
        error={buyNowError}
        hint="이 금액을 내면 기다리지 않고 바로 가져갑니다."
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">진행 시간</span>
        <Select
          label="진행 시간"
          options={DURATION_OPTIONS}
          value={durationHours}
          onChange={setDurationHours}
          className="shrink-0"
        />
      </div>

      <Button
        fullWidth
        disabled={!canSubmit}
        loading={isPending}
        onClick={() =>
          onSubmit({
            startPrice: start,
            buyNowPrice: hasBuyNow ? buyNow : undefined,
            durationHours: Number(durationHours),
          })
        }
      >
        경매 시작하기
      </Button>

      {/* 올린 뒤에 되돌릴 수 있는 범위를 미리 알려 줍니다 — 입찰이 붙으면 못 내립니다 */}
      <p className="text-subtle text-xs leading-relaxed">
        입찰이 하나라도 들어오면 경매를 취소할 수 없어요. 마감 시각이 되면 가장 높은 입찰자에게
        자동으로 넘어갑니다.
      </p>
    </div>
  );
}
