import { Spinner } from '@/shared/components/ui';
import { cn } from '@/shared/lib';

interface Props {
  /** 무엇을 불러오는 중인지 — "공연 목록을 불러오는 중" 처럼 */
  label?: string;
  className?: string;
}

/**
 * 목록·영역이 비어 있는 동안 보여주는 대기 표시.
 *
 * 스켈레톤만 깔면 "레이아웃이 깨진 건가?" 로 읽히는 경우가 있어서,
 * 목록에는 **도는 게 보이는** 스피너와 문구를 함께 둡니다.
 *
 * 세로 가운데에 놓입니다 — 상단에 붙어 있으면 아래쪽이 비어 보입니다.
 * 화면 전체가 비어 있을 때는 `PageLoader` 를 쓰세요.
 */
export function Loading({ label = '불러오는 중', className }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-[48dvh] flex-col items-center justify-center gap-2.5 py-10',
        className,
      )}
    >
      <Spinner size={26} className="text-brand-900" />
      <p className="text-subtle text-sm">{label}</p>
    </div>
  );
}
