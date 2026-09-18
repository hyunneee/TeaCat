import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useReducedMotion } from '@/shared/hooks';
import { cn, dialogTransition, reduceIfNeeded, sheetTransition } from '@/shared/lib';

export interface ModalProps {
  open?: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** 모바일에서 바텀시트처럼, 데스크톱에서는 가운데 다이얼로그로 */
  variant?: 'sheet' | 'center';
  /**
   * 패널 폭.
   *
   * `app`  기본. 폰 폭(`app-width`) 한 기둥 — 앱 화면의 모든 모달이 이걸 씁니다.
   * `wide` 데스크톱 전용 화면(어드민 콘솔)에서만. 입력이 여러 개인 폼을 336px 에
   *        넣으면 라벨과 값이 세로로 길게 늘어져 한 화면에 안 들어옵니다.
   *
   * 🔴 앱(모바일) 화면에서는 `wide` 를 쓰지 마세요 — 폰에서 프레임을 넘습니다.
   *    (`app-width` 한 기둥 규칙: DESIGN.md 5장 / client/CLAUDE.md 4-4)
   */
  width?: 'app' | 'wide';
  /** 결제 진행 중처럼 사용자가 닫으면 안 되는 상황 */
  dismissible?: boolean;
  /**
   * 되돌릴 수 없는 동작임을 알립니다.
   *
   * 상단 띠 같은 장식은 두지 않습니다 — 모달마다 다른 선이 생기면
   * 화면이 어수선해집니다. 위험 신호는 **내용과 버튼**으로 전합니다.
   * (ConfirmModal 의 붉은 아이콘 + danger 버튼)
   */
  danger?: boolean;
}

/**
 * 모든 모달의 껍데기. 내용물만 children 으로 갈아 끼우세요.
 * 스크롤 잠금 / ESC / 포탈 / 등장·퇴장 애니메이션은 전부 여기 있습니다.
 */
export function Modal({
  open = true,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'sheet',
  width = 'app',
  dismissible = true,
}: ModalProps) {
  const reduced = useReducedMotion();

  // 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC 로 닫기
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  const root = document.getElementById('modal-root');
  if (!root) return null;

  const panelVariants = reduceIfNeeded(
    variant === 'sheet' ? sheetTransition : dialogTransition,
    reduced,
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => dismissible && onClose()}
          className={cn(
            /* 🔴 **뒤 배경을 흐리지(backdrop-filter) 않습니다.** 예전에는
               흐림(`backdrop-filter: blur`)이 있었는데, 이 요소는 opacity 를 0→1 로 애니메이션합니다.
               흐림이 걸린 면의 투명도를 움직이면 브라우저가 **매 프레임 뒤 화면을 다시
               떠서 다시 흐려야** 하고, 모바일에서 그게 어긋나면서 화면 전체가 번쩍였습니다
               (QA: "모달 띄울 때마다 깜빡임"). 화면을 꽉 덮는 요소라 증상이 전면에 보입니다.
               `bg-black/70` 만으로 뒤 내용은 충분히 눌립니다 — 흐림을 되살리려면
               흐림 레이어와 페이드 레이어를 **분리**해야 합니다(얻는 것보다 복잡합니다). */
            'fixed inset-0 z-50 flex bg-black/70',
            /* 가로 가운데 정렬은 **항상** 필요합니다. 시트가 앱 폭으로 좁아지는
               구간(30rem~)에서 justify 가 없으면 시트가 화면 왼쪽에 붙습니다. */
            variant === 'sheet'
              ? 'items-end justify-center sm:items-center'
              : 'items-center justify-center p-4',
          )}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={panelVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'surface border-line shadow-pop pb-safe relative flex max-h-[90dvh] w-full flex-col overflow-hidden border',
              /* 폭은 앱 기둥과 같습니다 — 데스크톱에서 모달만 넓으면
                 프레임 밖으로 삐져나와 화면이 두 겹으로 보입니다. */
              variant === 'sheet' ? 'rounded-t-2xl sm:rounded-2xl' : 'rounded-2xl',
              /* 폭은 variant 와 독립입니다. wide 는 데스크톱 전용 화면에서만 씁니다 */
              width === 'wide' ? 'w-full max-w-xl' : 'app-width',
            )}
          >
            {/* 바텀시트 손잡이 */}
            {variant === 'sheet' && (
              <span aria-hidden className="bg-line-strong mx-auto mt-3 h-1 w-10 rounded-full" />
            )}

            {title && (
              <header className="shrink-0 px-5 pt-5 pb-2">
                <h2 className="text-lg font-bold">{title}</h2>
                {description && (
                  <p className="text-muted mt-1 text-sm leading-relaxed">{description}</p>
                )}
              </header>
            )}

            {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>}

            {footer && (
              <footer className="border-line shrink-0 border-t px-5 py-4">{footer}</footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    root,
  );
}
