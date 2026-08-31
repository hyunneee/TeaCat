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
  /**
   * 스크롤을 따라올지. 기본은 따라옵니다(true).
   *
   * ⚠️ `transparent` 와 함께 쓸 때는 **false 로 두세요.** 배경이 없는 헤더가
   * 화면에 붙어 있으면 본문이 그 아래로 지나가면서 글자가 겹쳐 읽힙니다.
   */
  sticky?: boolean;
  /**
   * 제목 정렬. 기본은 **가운데**입니다.
   * 좌우 버튼 유무와 무관하게 제목이 같은 자리에 있어야 화면을 바꿔도 눈이 헤매지 않습니다.
   * 왼쪽 정렬이 필요한 특수한 화면에서만 false 로 두세요.
   */
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
  sticky = true,
  centered = true,
  className,
}: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        'pt-safe z-30',
        sticky && 'sticky top-0',
        transparent ? 'bg-transparent' : 'surface',
        className,
      )}
    >
      <div className="relative flex h-(--spacing-header) items-center gap-1 px-2">
        {showBack && (
          <IconButton label="뒤로 가기" onClick={() => navigate(-1)}>
            <ChevronLeft size={22} />
          </IconButton>
        )}

        {left ? (
          <div className="flex min-w-0 flex-1 items-center px-2">{left}</div>
        ) : (
          /* 가운데 정렬은 flex 잔여 공간이 아니라 **화면 기준**이어야 합니다.
             flex-1 에 text-center 를 주면 뒤로가기 버튼만큼 제목이 오른쪽으로 밀려,
             화면을 넘길 때마다 제목이 조금씩 움직입니다.
             좌우 3.5rem 을 비워 버튼과 겹치지 않게 합니다. */
          <h1
            className={cn(
              'truncate text-base font-bold',
              centered
                ? 'pointer-events-none absolute inset-x-14 text-center'
                : cn('min-w-0 flex-1', showBack || onClose ? 'px-1' : 'px-2'),
            )}
          >
            {title}
          </h1>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {right}

          {onClose && (
            <IconButton label="닫기" onClick={onClose}>
              <X size={20} />
            </IconButton>
          )}
        </div>
      </div>
    </header>
  );
}
