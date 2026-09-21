import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** 문서 높이는 유지하고 내비의 표시 위치만 바꿔 스크롤 방향 감지의 피드백을 막는다. */
export function useScrollNavigation() {
  const { pathname } = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    let previous = Math.max(0, window.scrollY);
    let accumulated = 0;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.max(
        0,
        Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight),
      );
      const delta = y - previous;
      previous = y;
      if (window.innerWidth < 1024 || y < 80) {
        accumulated = 0;
        setHidden(false);
        return;
      }
      if (
        getComputedStyle(document.body).overflow === 'hidden' ||
        headerRef.current?.contains(document.activeElement)
      ) {
        accumulated = 0;
        return;
      }
      if (Math.sign(delta) !== Math.sign(accumulated)) accumulated = 0;
      accumulated += delta;
      if (accumulated >= 16) setHidden(true);
      if (accumulated <= -8) setHidden(false);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const resize = () => {
      previous = Math.max(0, window.scrollY);
      accumulated = 0;
      setHidden(false);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', resize);
    };
  }, [pathname]);

  return { headerRef, hidden, reveal: () => setHidden(false) };
}
