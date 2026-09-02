import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/shared/stores';
import { cn } from '@/shared/lib';

const STYLE: Record<ToastVariant, string> = {
  info: 'surface border-line-strong border',
  success: 'bg-brand-900 text-white',
  error: 'bg-danger text-white',
};

const ICON: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="app-width pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = ICON[toast.variant];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              role="status"
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg',
                STYLE[toast.variant],
              )}
            >
              <Icon size={17} className="shrink-0" />
              <span className="flex-1">{toast.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
