import { GraduationCap } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib';
import { startSsafyLogin } from '../hooks/useOauth';

interface Props {
  className?: string;
}

/**
 * SSAFY 계정으로 로그인 (OAuth).
 *
 * 1. 이 버튼 → 백엔드의 인가 시작 주소로 **페이지 이동**
 * 2. SSAFY 로그인 → 백엔드 콜백에서 토큰 발급 (리프레시 토큰은 httpOnly 쿠키)
 * 3. `/oauth/callback` 으로 복귀 → 처음이면 추가정보 화면, 아니면 홈
 *
 * ⚠️ 프론트에서 client_secret 을 다루지 않습니다. 인가 코드 교환은 백엔드 몫입니다.
 *    (VITE_ 값은 번들에 그대로 박혀 브라우저에서 누구나 읽습니다)
 */
export function SsafyLoginButton({ className }: Props) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      fullWidth
      className={cn(className)}
      leftIcon={<GraduationCap size={18} />}
      onClick={startSsafyLogin}
    >
      SSAFY 계정으로 계속하기
    </Button>
  );
}
