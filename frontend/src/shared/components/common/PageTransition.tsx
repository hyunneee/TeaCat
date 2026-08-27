import { motion } from 'motion/react';
import { Outlet, useLocation } from 'react-router-dom';
import { useReducedMotion } from '@/shared/hooks';
import { DURATION, EASE } from '@/shared/lib';

/**
 * 라우트가 바뀔 때 화면이 "휙" 갈리지 않도록 진입 애니메이션을 넣습니다.
 *
 * ⚠️ 일부러 AnimatePresence(교차 전환)를 쓰지 않습니다.
 *    `mode="wait"` 는 이전 화면의 exit 이 끝나야 새 화면을 붙이는데,
 *    한 번이라도 exit 이 끝나지 않으면 **네비게이션이 그대로 멈춥니다.**
 *    티켓팅 앱에서 화면이 안 넘어가는 건 치명적이라, 나가는 연출을 포기하고
 *    들어오는 연출만 남겼습니다. key 가 바뀌면 즉시 새 화면이 붙고 위로 떠오릅니다.
 *
 * 0.24s 로 짧게 유지합니다. 길면 티켓팅에서 방해가 됩니다.
 */
export function PageTransition() {
  const location = useLocation();
  const reduced = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduced ? DURATION.quick : DURATION.base, ease: EASE.out }}
      className="min-h-full"
    >
      <Outlet />
    </motion.div>
  );
}
