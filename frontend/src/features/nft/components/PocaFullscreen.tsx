import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { X } from 'lucide-react';
import { useReducedMotion } from '@/shared/hooks';
import { DURATION, EASE } from '@/shared/lib';
import { useGlareSweep } from '../hooks/useGlareSweep';
import { PocaArt } from './PocaArt';
import { PocaGlare } from './PocaGlare';

interface Props {
  open: boolean;
  onClose: () => void;
  seed: string;
  imageUrl?: string | null;
  name: string;
  concertTitle: string;
}

/** 몇 초마다 표면에 빛이 한 번 지나갈지 */
const SHINE_INTERVAL_MS = 5000;
/** 끝까지 끌었을 때의 기울기(도). 이보다 크면 카드가 아니라 문짝처럼 보입니다. */
const MAX_TILT = 16;
/** 이 거리(px)를 끌면 최대 기울기 */
const TILT_RANGE = 130;

/**
 * 포토카드 전체화면 보기.
 *
 * 실물 카드를 눈앞에 들어 **손으로 기울여 보는 것**에 해당합니다.
 * 아트 말고는 아무것도 두지 않고, 배경을 어둡게 깔아 카드만 남깁니다.
 *
 * ── 왜 공용 Modal 을 쓰지 않나 ─────────────────────────────
 * Modal 은 흰 시트에 제목·본문·푸터를 담는 껍데기입니다.
 * 여기 필요한 건 그 반대(테두리·여백 없는 검은 화면)라서,
 * Modal 에 예외 옵션을 늘리는 대신 별도 컴포넌트로 둡니다.
 *
 * 닫는 방법은 셋 — 배경 탭 / 아래 X 버튼 / ESC. 하나라도 막히면 갇힌 느낌이 듭니다.
 *
 * ⚠️ 퇴장(exit) 애니메이션을 쓰지 않습니다. AnimatePresence 의 exit 이 어떤 이유로든
 *    끝나지 않으면 **검은 화면이 그대로 남아 앱을 덮습니다.** 화면 전체를 가리는
 *    오버레이에서 그건 치명적이라, 나가는 연출을 포기하고 즉시 사라지게 합니다.
 *    (DESIGN.md 3장 — 페이지 전환에 AnimatePresence 를 쓰지 않는 것과 같은 이유)
 */
export function PocaFullscreen({ open, onClose, seed, imageUrl, name, concertTitle }: Props) {
  const reduced = useReducedMotion();

  /* 열려 있는 동안에만 반짝입니다 — 닫힌 오버레이에서 타이머가 돌 이유가 없습니다. */
  const { glare, intensity } = useGlareSweep({ repeatMs: SHINE_INTERVAL_MS, enabled: open });

  /* 끌면 기울어집니다. 놓으면 제자리로 돌아옵니다(dragConstraints 0 + 스프링).
     가로로 끌면 좌우로, 세로로 끌면 앞뒤로 — 실물 카드를 쥔 방향과 같습니다. */
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const rotateY = useTransform(dragX, [-TILT_RANGE, TILT_RANGE], [-MAX_TILT, MAX_TILT]);
  const rotateX = useTransform(dragY, [-TILT_RANGE, TILT_RANGE], [MAX_TILT, -MAX_TILT]);

  // 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const root = document.getElementById('modal-root');
  if (!root || !open) return null;

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} 크게 보기`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE.out }}
      onClick={onClose}
      className="pt-safe pb-safe fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-black/92 p-6"
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: DURATION.slow, ease: EASE.out }}
        // 카드 자체를 눌러도 닫히지 않게 (자세히 보려고 누르는 경우)
        onClick={(event) => event.stopPropagation()}
        drag={!reduced}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.4}
        dragMomentum={false}
        dragTransition={{ bounceStiffness: 320, bounceDamping: 28 }}
        style={{
          x: dragX,
          y: dragY,
          rotateX,
          rotateY,
          transformPerspective: 900,
        }}
        className="relative w-full max-w-[min(80vw,22rem)] cursor-grab touch-none active:cursor-grabbing"
      >
        <PocaArt seed={seed} imageUrl={imageUrl} alt={`${name} 포토카드`} />
        <PocaGlare glare={glare} intensity={intensity} />
      </motion.div>

      <div className="space-y-1.5 text-center">
        <p className="text-base font-bold text-white">{name}</p>
        <p className="text-sm text-white/60">{concertTitle}</p>
      </div>

      {/* 닫기는 **엄지가 닿는 아래쪽**에 둡니다.
          전체화면에서 우상단은 한 손으로 잡았을 때 가장 먼 자리입니다. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="flex size-12 items-center justify-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/22 active:bg-white/28"
      >
        <X size={22} />
      </button>
    </motion.div>,
    root,
  );
}
