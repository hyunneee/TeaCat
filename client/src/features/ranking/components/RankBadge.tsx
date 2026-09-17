import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/shared/lib';
import type { RankTrend } from '../model/ranking.types';

export function RankBadge({ rank, trend }: { rank: number; trend: RankTrend }) {
  const Icon = trend === 'UP' ? ArrowUp : trend === 'DOWN' ? ArrowDown : Minus;
  return (
    <span className="bg-surface-1 shadow-card absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-extrabold">
      {rank}
      {trend === 'NEW' ? (
        <span className="text-accent-800 text-[0.6rem]">NEW</span>
      ) : (
        <Icon className={cn(trend === 'UP' && 'text-accent-800', trend === 'DOWN' && 'text-muted')} size={11} />
      )}
    </span>
  );
}
