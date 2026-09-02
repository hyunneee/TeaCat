import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useReducedMotion } from '@/shared/hooks';
import { DURATION, EASE } from '@/shared/lib';

export interface LightboxProps {
  open: boolean;
  onClose: () => void;
  /** 스크린리더에 읽히는 이름 ("포스터 크게 보기") */
  label: string;
  /** 그림 아래 설명 — 제목·부제 등 */
  caption?: ReactNode;
  children: ReactNode;
}

/**
 * 그림 하나를 화면 가득 보여주는 껍데기. (포토카드 확대, 공연 포스터 확대)
 *
 * ── 왜 공용 Modal 을 쓰지 않나 ─────────────────────────────
 * Modal 은 흰 시트에 제목·본문·푸터를 담는 껍데기입니다.
 * 여기 필요한 건 그 반대(테두리·여백 없는 검은 화면)라서,
 * Modal 에 예외 옵션을 늘리는 대신 별도 컴포넌트로 둡니다.
 *
 * 안에 무엇을 넣을지는 부르는 쪽이 정합니다 — 기울어지는 포토카드든, 포스터든.
 * **확대해서 보는 화면을 새로 만들지 말고 이걸 쓰세요.**
 *
 * 닫는 방법은 셋 — 배경 탭 / 아래 X 버튼 / ESC. 하나라도 막히면 갇힌 느낌이 듭니다.
 *
 * ⚠️ 퇴장(exit) 애니메이션을 쓰지 않습니다. AnimatePresence 의 exit 이 어떤 이유로든
 *    끝나지 않으면 **검은 화면이 그대로 남아 앱을 덮습니다.** 화면 전체를 가리는
 *    오버레이에서 그건 치명적이라, 나가는 연출을 포기하고 즉시 사라지게 합니다.
 *    (DESIGN.md 3장 — 페이지 전환에 AnimatePresence 를 쓰지 않는 것과 같은 이유)
 */
export function Lightbox({ open, onClose, label, caption, children }: LightboxProps) {
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
      aria-label={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE.out }}
      onClick={onClose}
      /* overscroll-contain — 오버레이 위에서 손가락을 움직여도 뒤 페이지가
         고무줄처럼 딸려 오지 않게 (iOS) */
      className="pt-safe pb-safe fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 overscroll-contain bg-black/92 p-6"
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: DURATION.slow, ease: EASE.out }}
        // 그림 자체를 눌러도 닫히지 않게 (자세히 보려고 누르는 경우)
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[min(80vw,22rem)]"
      >
        {children}
      </motion.div>

      {caption && <div className="space-y-1.5 text-center">{caption}</div>}

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
