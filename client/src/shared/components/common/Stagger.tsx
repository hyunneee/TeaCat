import { createContext, use, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/shared/hooks';
import { cn, staggerChild, staggerChildFade, staggerParent } from '@/shared/lib';

/** `<Stagger fade>` 를 자식에게 알려주는 통로. props 로 내리면 호출부가 매번 적어야 합니다 */
const StaggerFadeContext = createContext(false);

interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** 항목 간 지연(초). 항목이 많으면 줄이세요. */
  gap?: number;
  as?: 'ul' | 'div';
  /**
   * 올라오지 않고 **페이드만** 합니다.
   *
   * 🔴 **글자만 있는 항목에 켜세요.** 기본값(올라오기)은 애니메이션이 끝나는 순간
   * 합성 레이어가 사라지면서 글자가 한 번 다시 그려집니다 — `staggerChildFade` 주석에
   * 자세히 적어 두었습니다. 카드·이미지 목록에서는 그게 안 보이므로 기본값이 낫습니다.
   */
  fade?: boolean;
}

/**
 * 목록이 순차적으로 등장합니다. 한꺼번에 나타나는 것보다 "읽는 순서"가 생깁니다.
 *
 *   <Stagger as="ul">
 *     {items.map((it) => <Stagger.Item as="li" key={it.id}>...</Stagger.Item>)}
 *   </Stagger>
 */
export function Stagger({ children, className, gap = 0.045, as = 'div', fade }: StaggerProps) {
  const reduced = useReducedMotion();
  const Component = as === 'ul' ? motion.ul : motion.div;

  return (
    /* 자식이 어떤 variant 를 쓸지는 컨텍스트로 내려보냅니다 — Stagger.Item 이
       부모를 알 필요 없이 같은 이름("hidden"/"show")만 쓰면 됩니다 */
    <StaggerFadeContext value={fade ?? false}>
      <Component
        variants={staggerParent(reduced ? 0 : gap)}
        initial="hidden"
        animate="show"
        className={className}
      >
        {children}
      </Component>
    </StaggerFadeContext>
  );
}

Stagger.Item = function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'li' | 'div';
}) {
  const Component = as === 'li' ? motion.li : motion.div;
  const fade = use(StaggerFadeContext);

  return (
    <Component variants={fade ? staggerChildFade : staggerChild} className={cn(className)}>
      {children}
    </Component>
  );
};
