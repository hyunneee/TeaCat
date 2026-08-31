import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib';

type Tone = 'default' | 'brand' | 'warning' | 'danger' | 'success';

/* 카드 톤 — 안내/경고/위험을 배경색만으로 구분되게 합니다.
   (DESIGN.md 의미 색상 규칙) */
/* 안내 카드는 **밝게** 둡니다. 회색 면을 깔면 "비활성" 처럼 읽혀서
   정작 읽어야 할 안내가 지나가 버립니다. 구분은 테두리와 아이콘이 합니다. */
const TONE: Record<Tone, string> = {
  default: 'surface border-line',
  brand: 'surface border-line-strong',
  warning: 'surface border-line-strong',
  danger: 'bg-danger-soft border-danger/25',
  success: 'surface border-line-strong',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 클릭 가능한 카드로 만들면 hover/press 반응이 붙습니다. */
  interactive?: boolean;
  padded?: boolean;
  tone?: Tone;
  /** 위쪽 테두리에 빛을 넣어 떠 있는 느낌을 줍니다 */
  raised?: boolean;
  /**
   * 테두리 없이 **흰 면 + 얕은 그림자**로만 띄웁니다.
   *
   * 한 화면에 카드가 여러 장 놓이는 곳(예매 플로우, 목록)에서는 테두리가
   * 줄줄이 겹쳐 화면이 선으로 가득 찹니다. 그럴 때 이걸 쓰세요.
   * 테두리 자체가 의미를 갖는 단독 안내 카드는 기본(tone)을 그대로 두세요.
   */
  flat?: boolean;
}

export function Card({
  interactive,
  padded = true,
  tone = 'default',
  raised = true,
  flat = false,
  className,
  onClick,
  ...rest
}: CardProps) {
  // 클릭 가능한 카드는 키보드로도 눌러야 합니다.
  // div 에 onClick 만 달면 Tab 으로 도달할 수 없고 스크린리더가 버튼으로 읽지 않습니다.
  const clickable = interactive && onClick;

  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.currentTarget.click();
            }
          : undefined
      }
      className={cn(
        'rounded-2xl border transition-all duration-200',
        /* 테두리는 투명하게 남겨둡니다 — 없애면 flat 여부에 따라 1px 씩 밀립니다 */
        flat ? 'surface shadow-card border-transparent' : TONE[tone],
        raised && !flat && 'edge-light',
        padded && 'p-4',
        interactive &&
          (flat ? 'hover:bg-surface-2 cursor-pointer active:scale-[0.99]' : 'cursor-pointer hover:border-line-strong active:scale-[0.99]'),
        className,
      )}
      {...rest}
    />
  );
}

/** 카드/섹션 안의 제목 줄 */
export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-2', className)}>
      <h2 className="text-[0.9375rem] font-bold">{title}</h2>
      {action}
    </div>
  );
}

export interface ListRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** 오른쪽 끝에 붙는 값/뱃지. 없으면 화살표만. */
  trailing?: ReactNode;
  /** 화살표 숨기기 (토글 스위치 같은 걸 넣을 때) */
  hideChevron?: boolean;
  /** 되돌릴 수 없는 동작 — 붉게 표시됩니다 */
  danger?: boolean;
}

/**
 * 설정/메뉴 목록의 한 줄.
 * 마이페이지·설정에서 반복되는 패턴이라 컴포넌트로 고정합니다.
 */
export function ListRow({
  icon,
  title,
  description,
  trailing,
  hideChevron,
  danger,
  className,
  ...rest
}: ListRowProps) {
  return (
    <button
      type="button"
      className={cn(
        'group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150',
        danger ? 'text-danger hover:bg-danger-soft/50' : 'hover:bg-surface-2',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      {...rest}
    >
      {icon && (
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
            danger ? 'bg-danger-soft text-danger' : 'surface-2 text-ink-muted group-hover:text-brand-700',
          )}
        >
          {icon}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium">{title}</span>
        {description && <span className="text-subtle block truncate text-xs">{description}</span>}
      </span>

      {trailing}
      {!hideChevron && (
        <ChevronRight
          size={18}
          className="text-subtle shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      )}
    </button>
  );
}
