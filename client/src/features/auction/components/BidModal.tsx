import { useState } from 'react';
import { Coins } from 'lucide-react';
import { Button, Input, Modal } from '@/shared/components/ui';

export interface BidModalProps {
  /** 넣을 수 있는 최소 금액 = 현재가 + 1 */
  min: number;
  /** 즉시구매가 − 1. 즉시구매가가 없으면 상한도 없습니다 */
  max: number | null;
  /** 지금 쓸 수 있는 캣머니 */
  available: number;
  /**
   * 성공하면 모달이 닫히고, 실패하면 **열린 채로 남습니다.**
   * 현재가가 올라 거절당했을 때 금액을 처음부터 다시 치게 하지 않으려는 것입니다.
   */
  onSubmit: (amount: number) => Promise<void>;
  /** 모달 시스템이 자동으로 주입합니다 */
  onClose?: () => void;
}

/**
 * 입찰 금액 입력.
 *
 * 하단 버튼 → 이 모달 한 단계로 끝냅니다. 금액을 넣는 화면과 확인하는 화면을
 * 따로 두면 경매처럼 급한 상황에서 두 번 누르게 됩니다.
 *
 * 막을 수 있는 것은 여기서 막습니다 — 현재가 이하, 즉시구매가 이상, 잔액 초과.
 * 그래도 서버가 다시 검사합니다. 내가 입력하는 동안 남이 먼저 올릴 수 있고,
 * **금액의 판정은 언제나 서버**입니다.
 */
export function BidModal({ min, max, available, onSubmit, onClose = () => {} }: BidModalProps) {
  const [value, setValue] = useState(String(min));
  const [submitting, setSubmitting] = useState(false);

  const amount = Number(value);
  const filled = value.length > 0 && amount > 0;

  const error = !filled
    ? null
    : amount < min
      ? `현재가보다 높은 ${min.toLocaleString()}캣머니 이상으로 넣어 주세요.`
      : max !== null && amount > max
        ? `즉시구매가 미만인 ${max.toLocaleString()}캣머니까지 넣을 수 있어요.`
        : amount > available
          ? `쓸 수 있는 캣머니가 부족해요. (${available.toLocaleString()}캣머니)`
          : null;

  const submit = async () => {
    if (!filled || error || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(amount);
      onClose();
    } catch {
      // 실패 사유는 훅이 토스트로 알려줍니다. 모달은 열어 둔 채 금액만 고치게 합니다.
      setSubmitting(false);
    }
  };

  return (
    <Modal
      variant="sheet"
      title="입찰하기"
      description={
        max === null
          ? `${min.toLocaleString()}캣머니부터 넣을 수 있어요.`
          : `${min.toLocaleString()} ~ ${max.toLocaleString()}캣머니`
      }
      onClose={onClose}
      footer={
        <Button
          size="lg"
          fullWidth
          disabled={!filled || !!error}
          loading={submitting}
          onClick={() => void submit()}
        >
          입찰하기
        </Button>
      }
    >
      <Input
        label="입찰 금액"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 9))}
        inputMode="numeric"
        leftIcon={<Coins size={16} />}
        error={error}
        hint={`쓸 수 있는 캣머니 ${available.toLocaleString()}개`}
      />

      {/* 입찰은 되돌릴 수 없습니다. 누르기 전에 알려 줍니다 — 누른 뒤에 알리면 늦습니다. */}
      <p className="text-subtle mt-3 text-xs leading-relaxed">
        입찰하면 그 금액만큼 캣머니가 묶이고, 더 높은 입찰이 나오면 바로 풀립니다. 한 번 넣은
        입찰은 취소할 수 없어요.
      </p>
    </Modal>
  );
}
