import { PartyPopper, Trophy } from 'lucide-react';
import { Confetti } from '@/shared/components/common';
import { Button, Modal } from '@/shared/components/ui';
import { formatClock } from '../model/memoryGame.model';
import type { MemoryGameResult } from '../model/memoryRanking.types';

interface Props {
  open: boolean;
  elapsedMs: number;
  moves: number;
  /** 서버가 확정한 결과. 아직 안 왔거나 기록에 실패했으면 null */
  result: MemoryGameResult | null;
  /** 1등 상금(캣머니). 랭킹 응답에서 옵니다 */
  prize?: number;
  onRestart: () => void;
  onClose: () => void;
}

/**
 * 다 맞췄을 때 화면 가운데 뜨는 알림.
 *
 * 🔴 **모두에게 캣머니를 주지 않습니다.** 그날 1등 한 사람만 다음날 받습니다. 그래서 여기에는
 * 금액이 아니라 <b>등수</b>를 띄웁니다 — 예전에는 클리어 등급마다 금액을 보여주면서
 * "지급 준비 중" 이라고 적어 두었는데, 실제 규칙이 생긴 지금은 그 화면이 거짓말이 됩니다.
 *
 * <p>등수는 <b>서버가 잰 시간</b> 기준입니다. 위에 보이는 시계와 조금 다를 수 있는데,
 * 순위에 들어간 값은 서버 쪽입니다 (`tokenApi.startMemoryGame` 주석).
 */
export function MemoryClearModal({
  open,
  elapsedMs,
  moves,
  result,
  prize,
  onRestart,
  onClose,
}: Props) {
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

          {/* 기록이 서버에 닿았을 때만 등수를 말합니다. 못 닿았으면 아무 말도 하지 않습니다 —
              "몇 등" 을 지어내면 순위표와 어긋납니다 */}
          {result !== null && (
            <div className="border-line surface-2 w-full rounded-xl border px-3 py-2.5">
              <p className="flex items-center justify-center gap-1.5 text-sm font-bold">
                <Trophy size={16} className="text-brand-500" aria-hidden />
                {result.todayRank === null ? (
                  '기록했어요'
                ) : (
                  <>
                    오늘 <span className="tabular-nums">{result.todayRank}</span>등
                  </>
                )}
              </p>
              <p className="text-subtle mt-1 text-[0.6875rem]">
                {result.todayRank === 1
                  ? prize
                    ? `이대로 1등이면 내일 ${prize.toLocaleString()} 캣머니를 받아요.`
                    : '이대로 1등이면 내일 캣머니를 받아요.'
                  : result.personalBest
                    ? '오늘 내 최고 기록이에요.'
                    : '오늘 내 최고 기록은 더 빨라요.'}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
