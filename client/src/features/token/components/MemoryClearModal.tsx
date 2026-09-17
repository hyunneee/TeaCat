import { Coins, PartyPopper } from 'lucide-react';
import { Confetti } from '@/shared/components/common';
import { Button, Modal } from '@/shared/components/ui';
import { formatClock } from '../model/memoryGame.model';

interface Props {
  open: boolean;
  elapsedMs: number;
  /** 🔴 아직 지급되지 않습니다 */
  reward: number | null;
  moves: number;
  onRestart: () => void;
  onClose: () => void;
}

/**
 * 다 맞췄을 때 화면 가운데 뜨는 알림.
 *
 * 🔴 **보상은 아직 붙이지 않았습니다.** 등급만 보여주고 잔액은 건드리지 않습니다 —
 * 붙일 때는 서버가 시간을 재고 금액을 정해야 합니다(`memoryGame.model` 의
 * `REWARD_TIERS` 주석). 그래서 화면에도 "지급 준비 중" 이라고 적어 둡니다.
 * 적립된 줄 알고 잔액을 확인하러 가는 사람이 생기면 안 됩니다.
 */
export function MemoryClearModal({ open, elapsedMs, reward, moves, onRestart, onClose }: Props) {
  return (
    <>
      {/* 🔴 폭죽은 모달보다 **위**여야 합니다. `Confetti` 는 스스로 z-40 이라 그냥 두면
          모달의 어두운 막(z-50) 아래에 깔려 거의 안 보입니다. z-60 인 고정 상자로
          감싸 쌓임 맥락을 새로 만들면, 공용 컴포넌트를 고치지 않고 위로 올릴 수 있습니다. */}
      {open && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-60">
          <Confetti />
        </div>
      )}

      <Modal
        open={open}
        onClose={onClose}
        variant="center"
        footer={
          <Button variant="dark" fullWidth onClick={onRestart}>
            다시 하기
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-3 pt-6 text-center">
          <div className="bg-accent-700 flex size-13 items-center justify-center rounded-full text-white">
            <PartyPopper size={24} />
          </div>

          <div className="space-y-1">
            <p className="text-lg font-extrabold">전부 찾았어요!</p>
            <p className="text-muted text-sm tabular-nums">
              {formatClock(elapsedMs)} · {moves}번 뒤집음
            </p>
          </div>

          {reward !== null && (
            <div className="border-line surface-2 w-full rounded-xl border px-3 py-2.5">
              <p className="flex items-center justify-center gap-1.5 text-sm font-bold">
                <Coins size={16} className="text-brand-500" aria-hidden />
                캣머니 +{reward}
              </p>
              {/* 🔴 이 줄을 지우지 마세요 — 지급을 붙이기 전까지는 사실과 다른 화면이 됩니다 */}
              <p className="text-subtle mt-1 text-[0.6875rem]">
                지급 준비 중이에요. 아직 잔액에 더해지지 않아요.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
