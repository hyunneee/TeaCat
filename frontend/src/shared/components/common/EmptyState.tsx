import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { CatMascot, type CatMood } from '@/shared/components/ui';
import { cn } from '@/shared/lib';

interface Props {
  /** 아이콘을 주면 아이콘, 안 주면 마스코트가 나옵니다. */
  icon?: LucideIcon;
  /** 마스코트 표정 (icon 을 안 넘겼을 때만) */
  mood?: CatMood;
  title: string;
  description?: string;
  action?: ReactNode;
  /** 남은 높이를 다 쓰게 하려면 `flex-1` 을 넘기세요 (세로 flex 화면에서) */
  className?: string;
}

/**
 * "예매 내역이 없어요" 같은 빈 목록 표시. 화면마다 새로 만들지 마세요.
 *
 * 화면 세로 가운데에 놓입니다. 목록 자리 맨 위에 붙어 있으면
 * "여기까지만 불러온 건가?" 로 읽혀서 사용자가 스크롤을 계속합니다.
 */
export function EmptyState({
  icon: Icon,
  mood = 'sad',
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className={cn(
        'flex min-h-[48dvh] flex-col items-center justify-center gap-4 px-6 py-10 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="surface-2 border-line text-ink-subtle flex size-16 items-center justify-center rounded-xl border">
          <Icon size={28} strokeWidth={1.5} />
        </span>
      ) : (
        <CatMascot mood={mood} size={84} />
      )}

      <div className="space-y-1">
        <p className="font-bold">{title}</p>
        {description && <p className="text-muted text-sm">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  );
}
