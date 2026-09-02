import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

/**
 * 라우트 lazy 로딩 / 데이터 로딩 중 전체 화면 대기.
 * 스피너만 있으면 멈춘 것처럼 보여서, 점 3개를 튕기게 했습니다.
 *
 * ── 왜 늦게 나타나나 ──────────────────────────────────────
 * 코드 조각이 캐시에 있으면 로딩은 수십 ms 만에 끝납니다. 그 짧은 순간에
 * 점 3개가 켜졌다 꺼지면 **화면이 한 번 깜빡인 것**처럼 보입니다.
 * 그래서 처음 `delayMs` 동안은 **자리만 잡고 아무것도 그리지 않습니다** —
 * 빠른 이동에서는 사용자가 로딩 표시를 아예 보지 않습니다.
 * (자리를 비워두는 이유는 늦게 나타날 때 화면이 밀리지 않게 하려는 것입니다)
 */
export function PageLoader({ delayMs = 180 }: { delayMs?: number }) {
  const [visible, setVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <div className="flex min-h-[55dvh] items-center justify-center gap-1.5">
      {visible &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="bg-brand-900 size-2.5 rounded-full"
            animate={{ y: [0, -9, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
          />
        ))}
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
