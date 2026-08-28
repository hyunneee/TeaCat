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
            'fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm',
            variant === 'sheet'
              ? 'items-end sm:items-center sm:justify-center'
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
              variant === 'sheet'
                ? 'rounded-t-2xl sm:max-w-md sm:rounded-2xl'
                : 'max-w-md rounded-2xl',
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

            {children && (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
            )}

            {footer && <footer className="border-line shrink-0 border-t px-5 py-4">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    root,
  );
}
