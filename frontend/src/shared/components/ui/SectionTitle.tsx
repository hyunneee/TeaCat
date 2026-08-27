import type { ReactNode } from 'react';
import { cn } from '@/shared/lib';

export interface SectionTitleProps {
  children: ReactNode;
  /** 오른쪽 끝 액션 (전체보기 등) */
  action?: ReactNode;
  description?: string;
  className?: string;
}

/**
 * 화면 안의 구획 제목.
 *
 * 앞에 브랜드 색 막대를 둬서 "여기서부터 새 구획" 이 한눈에 보이게 합니다.
 * 제목 없이 카드만 쌓으면 스크롤할 때 전부 같은 덩어리로 보입니다.
 */
export function SectionTitle({ children, action, description, className }: SectionTitleProps) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 gap-2.5">
        <span
          aria-hidden
          className="bg-brand-900 mt-1 h-4 w-1 shrink-0 rounded-full"
        />
        <div className="min-w-0">
          <h2 className="truncate font-bold">{children}</h2>
          {description && <p className="text-subtle mt-0.5 text-xs">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
