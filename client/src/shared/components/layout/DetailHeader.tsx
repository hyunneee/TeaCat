import { Header, type HeaderProps } from './Header';
import { cn } from '@/shared/lib';

export function DetailHeader({ className, ...props }: HeaderProps) {
  return (
    <Header
      {...props}
      className={cn(className, 'lg:hidden')}
    />
  );
}
