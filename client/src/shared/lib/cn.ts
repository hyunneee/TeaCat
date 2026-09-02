import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 조건부 클래스 + Tailwind 충돌 해결.
 *   cn('px-2 py-1', isActive && 'bg-brand-500', className)
 *   cn('px-2', 'px-4')  →  'px-4'   (뒤에 온 게 이김)
 * 컴포넌트가 className prop 을 받아 덮어쓸 수 있게 하려면 반드시 이걸 쓰세요.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
