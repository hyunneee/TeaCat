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
 * ⚠️ **transform(y·scale)을 쓰지 않습니다.** transform 이 걸린 요소는
 *    자손 `position: fixed` 의 기준(containing block)이 되어버립니다.
 *    그러면 화면 하단에 고정한 결제 버튼(BottomBar)이 전환 중에 뷰포트가 아니라
 *    **문서 아래쪽**으로 튀어서, 페이지가 바뀔 때마다 버튼이 한 번 흔들립니다.
 *    (좌석·결제 화면에서 이건 그냥 버그로 보입니다)
 *    그래서 이동 없이 **페이드만** 남겼습니다.
 *
 * 0.24s 로 짧게 유지합니다. 길면 티켓팅에서 방해가 됩니다.
 */
export function PageTransition() {
  const location = useLocation();
  const reduced = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? DURATION.quick : DURATION.base, ease: EASE.out }}
      className="min-h-full"
    >
      <Outlet />
    </motion.div>
  );
}
