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
export function BottomBar({
  children,
  className,
  inlineOnDesktop = false,
}: {
  children: ReactNode;
  className?: string;
  /**
   * 데스크톱(lg 이상)에서는 고정을 풀고 **본문 안의 한 줄**로 둡니다.
   *
   * 2단 상세처럼 오른쪽 패널에 버튼이 이미 보이는 화면용입니다. 여기 없으면 화면마다
   * `lg:static lg:mx-0 …` 를 손으로 적게 되고, 한쪽만 고치면 두 화면이 어긋납니다.
   * 🔴 모바일 여백(아래)은 건드리지 않습니다 — 그게 이 컴포넌트가 지키는 값입니다.
   */
  inlineOnDesktop?: boolean;
}) {
  return (
    <div
      className={cn(
        // PlainLayout 과 같은 폭 규칙을 사용합니다. 1024px 이상에서 본문만
        // max-w-3xl 로 넓어질 때 하단 바가 480px(app-width)에 남지 않게 합니다.
        'surface border-line fixed inset-x-0 bottom-0 z-20 mx-auto app-shell border-t lg:max-w-3xl',
        // pb-safe 는 padding-bottom 을 덮어쓰므로 여백과 노치를 한 번에 계산합니다.
        'px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]',
        inlineOnDesktop && 'lg:static lg:mx-0 lg:max-w-none lg:border-0 lg:bg-transparent lg:p-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * BottomBar 높이만큼 본문 아래 여백을 만듭니다.
 *
 * ⚠️ 위 여백값과 한 쌍입니다. 바가 실제로 떠 있을 때만 넣으세요 —
 * 바 없이 넣으면 화면 끝에 빈 띠가 남습니다.
 */
BottomBar.Spacer = function Spacer({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('h-[calc(7.5rem+env(safe-area-inset-bottom))]', className)} />
  );
};
