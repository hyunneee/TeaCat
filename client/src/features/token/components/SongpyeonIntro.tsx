import { motion } from 'motion/react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { useReducedMotion } from '@/shared/hooks';
import { DURATION, EASE } from '@/shared/lib';
import { STAGE_COUNT, STAGE_MS } from '../model/songpyeonGame.model';
import { SongpyeonPiece } from './SongpyeonPiece';

interface Props {
  onStart: () => void;
  /** 오늘의 보상 현황을 아직 받는 중 — 다 받기 전에는 시작시키지 않습니다 */
  loading?: boolean;
  /** 오늘 이미 성공했다 — 시작 버튼 대신 안내만 남습니다 */
  alreadyClaimed?: boolean;
  /** 통과하면 들어오는 금액. 서버가 준 값입니다 */
  reward: number | null;
}

/**
 * 시작 전 안내.
 *
 * 🔴 **오늘 이미 성공했으면 시작 버튼을 아예 두지 않습니다.** 눌리게 두고 끝에서 "이미
 * 받았어요" 를 띄우면 50초를 쓰고 나서야 알게 됩니다. 판정은 서버가 하고
 * (`useSongpyeonChallenge`), 여기서는 그 답을 먼저 보여줍니다.
 *
 * 짙은 면 위에 올라가므로 글자색은 물려받고 투명도로만 층을 만듭니다 (`MemoryIntro` 와 같은 규칙).
 */
export function SongpyeonIntro({ onStart, loading = false, alreadyClaimed = false, reward }: Props) {
  const reduced = useReducedMotion();

  return (
    <div className="flex flex-col items-center gap-4 px-6 text-center">
      {/* 송편이 통통 튀며 무엇을 잡는 게임인지 말해 줍니다 (동작 줄이기면 멈춥니다) */}
      <motion.div
        aria-hidden
        className="flex size-16 items-center justify-center rounded-2xl bg-white/12"
        animate={reduced ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 1.6, ease: EASE.out, repeat: Infinity, repeatDelay: 0.5 }}
      >
        <SongpyeonPiece kind="songpyeon" size={30} />
      </motion.div>

      {alreadyClaimed ? (
        <AlreadyClaimed />
      ) : (
        <>
          {/* 제목은 머리말이 이미 말합니다 — 여기서 또 적으면 100px 안에서 두 번 읽힙니다 */}
          <p className="text-sm leading-relaxed opacity-70">
            떴다 사라지는 것들 중 <b className="font-bold">송편만</b> 잡으세요.
            <br />
            한 단계는 {STAGE_MS / 1000}초, 단계가 오를수록 빨라져요.
            <br />
            송편이 아닌 걸 잡으면 1단계부터 다시예요.
          </p>

          {reward !== null && (
            <p className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold">
              {STAGE_COUNT}단계까지 통과하면 캣머니 {reward.toLocaleString()}
            </p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE.out }}
            className="w-full max-w-56"
          >
            {/* 짙은 면 위에서는 흰 알약이 가장 또렷합니다 (초록 primary 는 배경에 묻힙니다) */}
            <Button variant="secondary" size="md" fullWidth loading={loading} onClick={onStart}>
              게임 시작
            </Button>
          </motion.div>
        </>
      )}
    </div>
  );
}

/**
 * 오늘 몫이 끝났을 때.
 *
 * 하루 한 번이라는 사실과 **언제 다시 되는지**를 같이 말합니다. "이미 받았어요" 만 있으면
 * 고장인지 규칙인지 알 수 없습니다.
 */
function AlreadyClaimed() {
  return (
    <div className="space-y-2">
      <p className="flex items-center justify-center gap-1.5 text-base font-extrabold">
        <CalendarClock size={18} className="opacity-70" aria-hidden />
        오늘 게임을 이미 성공했어요
      </p>
      <p className="text-sm opacity-70">내일 또 도전해주세요</p>
    </div>
  );
}
