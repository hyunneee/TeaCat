import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';

/**
 * 화면 하단에 고정되는 액션 영역 (다음/결제하기 버튼 등).
 *
 * 본문이 가려지지 않도록 `<BottomBar.Spacer />` 를 본문 끝에 넣으세요.
 *
 * 하단 여백을 넉넉히 둡니다. 화면 맨 끝에 버튼이 붙으면
 *   - 엄지가 닿기 어렵고
 *   - 모바일 브라우저의 주소창·제스처 바에 가려지며
 *   - safe-area 가 0 인 기기(안드로이드 등)에서는 그야말로 바닥에 붙습니다.
 */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'surface-glass border-line fixed inset-x-0 bottom-0 z-20 mx-auto max-w-screen-sm border-t',
        // pb-safe 는 padding-bottom 을 덮어쓰므로 여백과 노치를 한 번에 계산합니다.
        'px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]',
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
    <div aria-hidden className={cn('h-[calc(7.5rem+env(safe-area-inset-bottom))]', className)} />
  );
};
