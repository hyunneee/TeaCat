import { useEffect, useState } from 'react';
import { Coins, Minus, Plus } from 'lucide-react';
import { Button, Input, Modal, Skeleton } from '@/shared/components/ui';
import { useAdminCatMoney } from '../hooks/useAdminCatMoney';
import type { AdminCatMoneyDirection } from '../model/adminCatMoney.types';
import type { AdminUser } from '../model/adminUser.types';

/**
 * 캣머니 조정 — <b>테스트용</b>입니다.
 *
 * <p>QA 가 예매·경매·포카 마켓을 돌려보려면 잔액이 필요한데 매번 토스 결제창을 태울 수
 * 없어서 둔 화면입니다.
 *
 * <p>넣기와 빼기를 <b>같은 입력에 부호로</b> 주지 않습니다. -1000 을 1000 으로 잘못 읽는
 * 실수가 조용히 돈을 넣어버립니다. 방향은 버튼이 정합니다.
 */
export interface AdminCatMoneyModalProps {
  /** null 이면 닫힘 */
  user: AdminUser | null;
  onClose: () => void;
}

/** 자주 쓰는 금액. 매번 0 을 세어 치는 것이 이 화면의 가장 흔한 실수입니다 */
const PRESETS = [10_000, 50_000, 100_000] as const;

/** 서버 DTO 의 @Max 와 같은 값입니다. 오타로 0 을 더 붙이는 사고를 막습니다 */
const MAX_AMOUNT = 100_000_000;

const format = (value: number) => value.toLocaleString();

export function AdminCatMoneyModal({ user, onClose }: AdminCatMoneyModalProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { balance, adjust } = useAdminCatMoney(user?.userId ?? null);

  // 대상이 바뀌면 앞 사람에게 입력한 금액이 남아 있지 않게 비웁니다
  useEffect(() => {
    setAmount('');
    setError(null);
  }, [user]);

  const parsed = Number(amount.replace(/,/g, ''));
  const valid = amount !== '' && Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_AMOUNT;

  const submit = (direction: AdminCatMoneyDirection) => {
    if (!user) return;

    if (!valid) {
      setError(
        amount === ''
          ? '금액을 입력해 주세요.'
          : `1 이상 ${format(MAX_AMOUNT)} 이하의 정수를 넣어 주세요.`,
      );
      return;
    }

    /* 성공했을 때만 비웁니다. 실패한 뒤에도 비우면 관리자가 금액을 다시 쳐야 하는데,
       실패의 가장 흔한 이유가 "잠시 후 다시" 라서 그대로 두는 편이 낫습니다 */
    adjust.mutate(
      { targetUserId: user.userId, direction, amount: parsed },
      { onSuccess: () => setAmount('') },
    );
  };

  const available = balance.data?.available ?? 0;

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      variant="center"
      width="wide"
      title="캣머니 조정"
      description={user ? `${user.nickname} (${user.email})` : undefined}
      footer={
        <div className="flex gap-2">
          <Button
            variant="danger"
            fullWidth
            leftIcon={<Minus size={16} />}
            onClick={() => submit('burn')}
            loading={adjust.isPending && adjust.variables?.direction === 'burn'}
            disabled={adjust.isPending || available <= 0}
          >
            빼기
          </Button>
          <Button
            variant="dark"
            fullWidth
            leftIcon={<Plus size={16} />}
            onClick={() => submit('grant')}
            loading={adjust.isPending && adjust.variables?.direction === 'grant'}
            disabled={adjust.isPending}
          >
            넣기
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* ── 현재 잔액 ── */}
        <div className="bg-surface-2 flex flex-col gap-1.5 rounded-lg px-3 py-2.5">
          {balance.isPending ? (
            <Skeleton className="h-9 w-full" />
          ) : balance.isError ? (
            <p className="text-ink-muted text-xs">
              잔액을 불러오지 못했어요. 지갑이 없는 계정일 수 있어요.
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-ink-muted text-xs">쓸 수 있는 잔액</span>
                <span className="text-ink flex items-center gap-1 text-lg font-bold tabular-nums">
                  <Coins size={15} className="text-ink-muted" />
                  {format(available)}
                </span>
              </div>

              {/* 묶인 돈이 있을 때만 보여줍니다. 0 이면 줄만 차지합니다 */}
              {(balance.data?.held ?? 0) > 0 && (
                <p className="text-ink-subtle text-right text-xs tabular-nums">
                  체인 잔액 {format(balance.data?.balance ?? 0)} · 묶인 돈{' '}
                  {format(balance.data?.held ?? 0)}
                </p>
              )}
            </>
          )}
        </div>

        {/* ── 금액 ── */}
        <Input
          label="금액"
          type="text"
          inputMode="numeric"
          placeholder="예: 50000"
          value={amount}
          onChange={(e) => {
            // 숫자만 받습니다. 붙여넣기로 들어온 콤마·공백은 지웁니다
            setAmount(e.target.value.replace(/[^\d]/g, ''));
            setError(null);
          }}
          error={error}
          maxLength={9}
        />

        <div className="flex gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset}
              variant="soft"
              size="sm"
              onClick={() => {
                setAmount(String(preset));
                setError(null);
              }}
            >
              +{format(preset)}
            </Button>
          ))}
        </div>

        {/* ── 알아야 할 것 ──
            둘 다 눌러보기 전에는 알 수 없는 동작이라 미리 적습니다. */}
        <ul className="text-ink-muted flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed">
          <li>
            <strong>넣기</strong>는 체인 확정까지 약 10초 걸립니다. 바로 잔액이 안 바뀌어도
            정상이고, 잠시 뒤 다시 불러옵니다.
          </li>
          <li>
            <strong>빼기</strong>는 쓸 수 있는 잔액까지만 됩니다. 더 큰 금액을 넣으면 남은 만큼만
            빠집니다 — 잔액을 0 으로 만들 때 쓰세요.
          </li>
          <li>테스트용 조정이라 원화와 짝이 없습니다. 매출 집계에는 잡히지 않습니다.</li>
        </ul>
      </div>
    </Modal>
  );
}
