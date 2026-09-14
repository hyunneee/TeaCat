import { motion } from 'motion/react';
import { cn } from '@/shared/lib';
import packUrl from '@/assets/poca/pack.webp';

interface Props {
  className?: string;
  /** 주면 누를 수 있게 됩니다 */
  onClick?: () => void;
}

/**
 * 봉지 그림 **하나만**.
 *
 * 목록의 `PocaPackTile` 과 달리 칸도 이름표도 없습니다 — 수령 화면처럼 화면에 봉지 말고는
 * 아무것도 없을 때, 칸을 두르면 그 검은 배경 위에 흰 네모가 떠서 봉지보다 눈에 띕니다.
 *
 * 살짝 떠 있습니다(`poca-float`). `prefers-reduced-motion` 이면 멈춥니다.
 */
export function PocaPackArt({ className, onClick }: Props) {
  const art = (
    <img
      src={packUrl}
      alt=""
      draggable={false}
      className={cn(
        'motion-safe:animate-poca-float w-full object-contain drop-shadow-[0_18px_32px_rgba(0,0,0,0.5)]',
        !onClick && className,
      )}
    />
  );

  if (!onClick) return art;

  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.96 }} className={className}>
      {art}
    </motion.button>
  );
}
