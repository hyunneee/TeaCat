import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { IconButton } from '@/shared/components/ui';
import { cn } from '@/shared/lib';

export interface HeaderProps {
  title?: string;
  /** 제목 대신 왼쪽에 넣을 것 (홈의 로고 등) */
  left?: ReactNode;
  /** 뒤로가기 버튼 */
  showBack?: boolean;
  /** X 버튼 (플로우 이탈용). onClose 를 주면 표시됩니다. */
  onClose?: () => void;
  right?: ReactNode;
  /** 좌석맵처럼 전체 화면을 쓸 때 배경 투명 */
  transparent?: boolean;
  /** 제목을 가운데 정렬 (모달성 화면) */
  centered?: boolean;
  className?: string;
}

export function Header({
  title,
  left,
  showBack = false,
  onClose,
  right,
  transparent = false,
  centered = false,
  className,
}: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        'pt-safe sticky top-0 z-30',
        transparent ? 'bg-transparent' : 'surface-glass border-line border-b',
        className,
      )}
    >
      <div className="flex h-(--spacing-header) items-center gap-1 px-2">
        {showBack && (
          <IconButton label="뒤로 가기" onClick={() => navigate(-1)}>
            <ChevronLeft size={22} />
          </IconButton>
        )}

        {left ? (
          <div className="flex min-w-0 flex-1 items-center px-2">{left}</div>
        ) : (
          <h1
            className={cn(
              'min-w-0 flex-1 truncate text-base font-bold',
              showBack || onClose ? 'px-1' : 'px-2',
              centered && 'text-center',
            )}
          >
            {title}
          </h1>
        )}

        {right}

        {onClose && (
          <IconButton label="닫기" onClick={onClose}>
            <X size={20} />
          </IconButton>
        )}
      </div>
    </header>
  );
}
