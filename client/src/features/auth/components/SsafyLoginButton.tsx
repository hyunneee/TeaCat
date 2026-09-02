import { GraduationCap } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { toast } from '@/shared/stores';
import { cn } from '@/shared/lib';

interface Props {
  className?: string;
}

/**
 * SSAFY 계정으로 로그인 (OAuth) — **자리만 잡아둔 버튼**입니다.
 *
 * 실제 연동은 이렇게 됩니다:
 *   1. 이 버튼 → 백엔드의 인가 시작 주소로 **페이지 이동**
 *      `window.location.href = \`${'${env.apiBaseUrl}'}/oauth2/authorization/ssafy\``
 *   2. SSAFY 로그인 → 백엔드 콜백에서 토큰 발급
 *   3. 우리 앱의 리디렉션 주소로 복귀 → 세션 저장 → 홈
 *
 * ⚠️ 프론트에서 client_secret 을 다루지 않습니다. 인가 코드 교환은 백엔드 몫입니다.
 *    (VITE_ 값은 번들에 그대로 박혀 브라우저에서 누구나 읽습니다)
 *
 * 백엔드 주소가 정해지면 onClick 만 위 1번으로 바꾸면 됩니다.
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
      onClick={() => toast.info('SSAFY 로그인은 준비 중이에요.')}
    >
      SSAFY 계정으로 계속하기
    </Button>
  );
}
