import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/shared/hooks';
import { cn, staggerChild, staggerParent } from '@/shared/lib';

interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** 항목 간 지연(초). 항목이 많으면 줄이세요. */
  gap?: number;
  as?: 'ul' | 'div';
}

/**
 * 목록이 순차적으로 등장합니다. 한꺼번에 나타나는 것보다 "읽는 순서"가 생깁니다.
 *
 *   <Stagger as="ul">
 *     {items.map((it) => <Stagger.Item as="li" key={it.id}>...</Stagger.Item>)}
 *   </Stagger>
 */
export function Stagger({ children, className, gap = 0.045, as = 'div' }: StaggerProps) {
  const reduced = useReducedMotion();
  const Component = as === 'ul' ? motion.ul : motion.div;

  return (
    <Component
      variants={staggerParent(reduced ? 0 : gap)}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </Component>
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
  return (
    <Component variants={staggerChild} className={cn(className)}>
      {children}
    </Component>
  );
};
