import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { useReducedMotion } from '@/shared/hooks';
import { DURATION, EASE } from '@/shared/lib';
import { PAIR_COUNT } from '../model/memoryGame.model';

interface Props {
  onStart: () => void;
}

/**
 * 시작 전 안내.
 *
 * 판을 미리 깔아 두고 "시작" 을 누르게 하지 않습니다 — 엎어 둔 카드가 보이면
 * 누르고 싶어지고, 그때부터 시간이 가는지 아닌지가 모호해집니다.
 *
 * 짙은 면 위에 올라가므로 글자색은 물려받고 투명도로만 층을 만듭니다
 * (`text-muted` 는 어두운 회색이라 여기서 안 보입니다 — `MemoryHud` 와 같은 규칙).
 */
export function MemoryIntro({ onStart }: Props) {
  const reduced = useReducedMotion();

  return (
    <div className="flex flex-col items-center gap-4 px-6 text-center">
      {/* 카드 한 장이 계속 뒤집히며 무슨 게임인지 말해 줍니다 (동작 줄이기면 멈춥니다) */}
      <motion.div
        aria-hidden
        className="flex size-16 items-center justify-center rounded-2xl bg-white/12"
        animate={reduced ? undefined : { rotateY: [0, 180, 360] }}
        transition={{ duration: 2.4, ease: EASE.out, repeat: Infinity, repeatDelay: 1.1 }}
        style={{ transformPerspective: 600 }}
      >
        <Sparkles size={24} />
      </motion.div>

      <div className="space-y-1">
        <p className="text-lg font-extrabold">포토카드 짝 맞추기</p>
        <p className="text-sm leading-relaxed opacity-70">
          16장 중 같은 그림 {PAIR_COUNT}쌍을 모두 찾으면 끝나요.
          <br />
          빨리 맞출수록 좋은 기록이 남아요.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE.out }}
        className="w-full max-w-56"
      >
        {/* 짙은 면 위에서는 흰 알약이 가장 또렷합니다 (초록 primary 는 배경에 묻힙니다) */}
        <Button variant="secondary" size="md" fullWidth onClick={onStart}>
          게임 시작
        </Button>
      </motion.div>
    </div>
  );
}
