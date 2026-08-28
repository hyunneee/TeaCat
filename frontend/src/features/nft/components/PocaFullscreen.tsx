import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useReducedMotion } from '@/shared/hooks';
import { DURATION, EASE } from '@/shared/lib';
import { PocaArt } from './PocaArt';
import { RarityBadge } from './RarityBadge';
import type { Rarity } from '../model/nft.types';

interface Props {
  open: boolean;
  onClose: () => void;
  seed: string;
  rarity: Rarity;
  imageUrl?: string | null;
  name: string;
  concertTitle: string;
}

/**
 * 포토카드 전체화면 보기.
 *
 * 실물 카드를 눈앞에 들어 보는 것에 해당합니다. 아트 말고는 아무것도 두지 않고,
 * 배경을 어둡게 깔아 카드만 남깁니다.
 *
 * ── 왜 공용 Modal 을 쓰지 않나 ─────────────────────────────
 * Modal 은 흰 시트에 제목·본문·푸터를 담는 껍데기입니다.
 * 여기 필요한 건 그 반대(테두리·여백 없는 검은 화면)라서,
 * Modal 에 예외 옵션을 늘리는 대신 별도 컴포넌트로 둡니다.
 *
 * 닫는 방법은 셋 — 배경 탭 / X 버튼 / ESC. 하나라도 막히면 갇힌 느낌이 듭니다.
 *
 * ⚠️ 퇴장(exit) 애니메이션을 쓰지 않습니다. AnimatePresence 의 exit 이 어떤 이유로든
 *    끝나지 않으면 **검은 화면이 그대로 남아 앱을 덮습니다.** 화면 전체를 가리는
 *    오버레이에서 그건 치명적이라, 나가는 연출을 포기하고 즉시 사라지게 합니다.
 *    (DESIGN.md 3장 — 페이지 전환에 AnimatePresence 를 쓰지 않는 것과 같은 이유)
 */
export function PocaFullscreen({
  open,
  onClose,
  seed,
  rarity,
  imageUrl,
  name,
  concertTitle,
}: Props) {
  const reduced = useReducedMotion();

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
      className="pt-safe pb-safe fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/92 p-6"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-4 flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X size={22} />
      </button>

      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: DURATION.slow, ease: EASE.out }}
        // 카드 자체를 눌러도 닫히지 않게 (자세히 보려고 누르는 경우)
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[min(80vw,22rem)]"
        style={{ maxHeight: '70dvh' }}
      >
        <PocaArt seed={seed} rarity={rarity} imageUrl={imageUrl} alt={`${name} 포토카드`} />
      </motion.div>

      <div className="space-y-1.5 text-center">
        <RarityBadge rarity={rarity} />
        <p className="text-base font-bold text-white">{name}</p>
        <p className="text-sm text-white/60">{concertTitle}</p>
      </div>

      <p className="text-xs text-white/40">화면을 탭하면 닫힙니다</p>
    </motion.div>,
    root,
  );
}
