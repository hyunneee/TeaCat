import { motion } from 'motion/react';

/**
 * 라우트 lazy 로딩 / 데이터 로딩 중 전체 화면 대기.
 * 스피너만 있으면 멈춘 것처럼 보여서, 강조색 점 3개를 튕기게 했습니다.
 */
export function PageLoader() {
  return (
    <div className="flex min-h-[55dvh] items-center justify-center gap-1.5">
      {[0, 1, 2].map((i) => (
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
