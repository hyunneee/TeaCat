import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';

/**
 * 화면 하단에 고정되는 액션 영역 (다음/결제하기 버튼 등).
 *
 * 본문이 가려지지 않도록 `<BottomBar.Spacer />` 를 본문 끝에 넣으세요.
 * 하단에 여유(pb-5)를 둡니다 — 화면 맨 끝에 버튼이 붙으면 엄지가 닿기 어렵고
 * 모바일 브라우저 하단 UI 에 가려집니다.
 */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'surface-glass border-line pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto max-w-screen-sm border-t',
        'px-4 pt-4 pb-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** BottomBar 높이만큼 본문 아래 여백을 만듭니다. */
BottomBar.Spacer = function Spacer({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('h-[calc(6.5rem+env(safe-area-inset-bottom))]', className)} />
  );
};
