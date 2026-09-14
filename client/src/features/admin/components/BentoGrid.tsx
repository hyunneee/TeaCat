import type { ReactNode } from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib';
import { AnimatedNumber, Card } from '@/shared/components/ui';

/**
 * 벤토 그리드.
 *
 * 12칸 기준이고 타일이 `span` 으로 자리를 먹습니다. 타일을 추가하면
 * 알아서 다음 줄로 넘어가므로 부모를 손댈 필요가 없습니다.
 *
 * 🔴 데스크톱 전용 화면이라 브레이크포인트를 두지 않습니다 —
 *    `AdminLayout` 이 lg 미만에서 대시보드를 아예 안 그립니다.
 */
export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-12 gap-4', className)}>{children}</div>;
}

/** 12칸 중 몇 칸을 먹을지. 자주 쓰는 조합만 둡니다 */
type Span = 3 | 4 | 6 | 8 | 12;

const SPAN: Record<Span, string> = {
  3: 'col-span-3',
  4: 'col-span-4',
  6: 'col-span-6',
  8: 'col-span-8',
  12: 'col-span-12',
};

export interface BentoTileProps {
  title: string;
  /** 제목 아래 한 줄 설명 */
  description?: string;
  icon?: LucideIcon;
  span?: Span;
  /** 누르면 이동. 주면 타일 전체가 링크가 됩니다 */
  to?: string;
  /** 오른쪽 위에 두는 것 (버튼·배지 등) */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * 벤토 타일 하나.
 *
 * `to` 를 주면 카드 전체가 링크입니다. 카드 안에 또 버튼을 넣으면 중첩 클릭이
 * 되므로, 링크 타일에는 `action` 에 버튼을 넣지 마세요.
 */
export function BentoTile({
  title,
  description,
  icon: Icon,
  span = 4,
  to,
  action,
  children,
  className,
}: BentoTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon size={16} className="text-ink-subtle shrink-0" aria-hidden />}
          <h2 className="text-ink truncate text-sm font-semibold">{title}</h2>
        </div>
        {to ? <ArrowRight size={16} className="text-ink-subtle shrink-0" aria-hidden /> : action}
      </div>

      {description && <p className="text-ink-muted mt-1 text-xs leading-relaxed">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </>
  );

  const card = (
    <Card padded className={cn('h-full', to && 'hover:shadow-pop transition-shadow', className)}>
      {body}
    </Card>
  );

  return (
    <div className={SPAN[span]}>
      {to ? (
        <Link to={to} className="block h-full rounded-2xl focus-visible:outline-2">
          {card}
        </Link>
      ) : (
        card
      )}
    </div>
  );
}

export interface StatTileProps {
  label: string;
  value: number | undefined;
  /** 숫자 뒤에 붙는 단위 */
  unit?: string;
  icon?: LucideIcon;
  span?: Span;
  /** 숫자 아래 보조 설명 */
  caption?: string;
}

/**
 * 숫자 하나를 크게 보여주는 타일.
 *
 * 위계는 색이 아니라 **크기·굵기**로 만듭니다 (DESIGN.md). 숫자에 색을 넣지 마세요.
 */
export function StatTile({ label, value, unit, icon: Icon, span = 3, caption }: StatTileProps) {
  return (
    <div className={SPAN[span]}>
      <Card padded className="h-full">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-ink-subtle shrink-0" aria-hidden />}
          <p className="text-ink-muted truncate text-xs font-medium">{label}</p>
        </div>

        <p className="text-ink mt-2 flex items-baseline gap-1 text-2xl font-bold tabular-nums">
          {value === undefined ? (
            <span className="text-ink-subtle">—</span>
          ) : (
            <AnimatedNumber value={value} format="plain" />
          )}
          {unit && <span className="text-ink-muted text-sm font-medium">{unit}</span>}
        </p>

        {caption && <p className="text-ink-subtle mt-1 text-xs">{caption}</p>}
      </Card>
    </div>
  );
}
