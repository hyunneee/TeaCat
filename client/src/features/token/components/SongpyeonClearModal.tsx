import { Coins, PartyPopper, RefreshCw } from 'lucide-react';
import { Confetti } from '@/shared/components/common';
import { Button, Modal, Spinner } from '@/shared/components/ui';
import { STAGE_COUNT } from '../model/songpyeonGame.model';

interface Props {
  open: boolean;
  /** 받게 되는 금액. 서버가 준 값입니다 */
  reward: number | null;
  /** 지급을 청구하는 중 */
  claiming: boolean;
  /** 청구가 실패했다 (이미 받은 날은 실패가 아닙니다) */
  failed: boolean;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * 5단계를 다 통과했을 때 뜨는 알림.
 *
 * 🔴 **"들어왔어요" 가 아니라 "곧 들어와요" 입니다.** 캣머니는 체인이 발행하고 확정까지 블록
 * 하나(약 10초)가 걸립니다 — 지금 잔액을 보러 가면 아직 예전 값입니다. 다 됐다고 적어 두면
 * 사용자는 잔액 화면에서 새로고침을 반복하게 됩니다. (`dailyReward.types` 주석)
 */
export function SongpyeonClearModal({ open, reward, claiming, failed, onRetry, onClose }: Props) {
  return (
    <>
      {/* 🔴 폭죽은 모달보다 **위**여야 합니다. `Confetti` 는 스스로 z-40 이라 그냥 두면
          모달의 어두운 막(z-50) 아래에 깔려 거의 안 보입니다 (`MemoryClearModal` 과 같은 처리) */}
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
          failed ? (
            <Button variant="dark" fullWidth leftIcon={<RefreshCw size={16} />} onClick={onRetry}>
              다시 받기
            </Button>
          ) : (
            <Button variant="dark" fullWidth onClick={onClose}>
              확인
            </Button>
          )
        }
      >
        <div className="flex flex-col items-center gap-3 pt-6 text-center">
          <div className="bg-accent-700 flex size-13 items-center justify-center rounded-full text-white">
            <PartyPopper size={24} />
          </div>

          <div className="space-y-1">
            <p className="text-lg font-extrabold">{STAGE_COUNT}단계 모두 통과!</p>
            <p className="text-muted text-sm">송편만 골라 잡았어요.</p>
          </div>

          <div className="border-line surface-2 w-full rounded-xl border px-3 py-2.5">
            {failed ? (
              <p className="text-danger text-sm font-bold">
                캣머니를 받지 못했어요. 다시 눌러 주세요.
              </p>
            ) : (
              <>
                <p className="flex items-center justify-center gap-1.5 text-sm font-bold">
                  {claiming ? (
                    <Spinner />
                  ) : (
                    <Coins size={16} className="text-brand-500" aria-hidden />
                  )}
                  캣머니 +{(reward ?? 0).toLocaleString()}
                </p>
                {/* 🔴 이 줄을 지우지 마세요 — 체인 확정 전이라 잔액은 아직 예전 값입니다 */}
                <p className="text-subtle mt-1 text-[0.6875rem]">
                  잔액에 반영되기까지 10초쯤 걸려요.
                </p>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
