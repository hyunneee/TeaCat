import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, User } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Input, Logo } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { env } from '@/shared/config';
import { SsafyLoginButton, useLogin } from '@/features/auth';

export function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ loginId, password });
  };

  return (
    <>
      <Header showBack />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        <div className="mb-2 flex flex-col items-center gap-3 py-4">
          <Logo size={52} />
          <p className="text-subtle text-sm">암표 없는 티켓팅</p>
        </div>

        <Input
          label="아이디"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder="아이디를 입력하세요"
          autoComplete="username"
          leftIcon={<User size={17} />}
        />

        <Input
          label="비밀번호"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호를 입력하세요"
          autoComplete="current-password"
          leftIcon={<KeyRound size={17} />}
        />

        {/* type="submit" 을 명시해야 폼 전송이 됩니다 (Button 기본값은 button) */}
        <Button
          type="submit"
          variant="dark"
          size="lg"
          fullWidth
          className="mt-2"
          loading={login.isPending}
          disabled={!loginId || !password}
        >
          로그인
        </Button>

        {/* 구분선 — 어느 쪽이 주된 방법인지 흐트러지지 않게 아래에 둡니다 */}
        <div className="my-1 flex items-center gap-3">
          <span className="bg-line h-px flex-1" />
          <span className="text-subtle text-xs">또는</span>
          <span className="bg-line h-px flex-1" />
        </div>

        <SsafyLoginButton />

        <p className="text-muted text-center text-sm">
          아직 계정이 없으신가요?{' '}
          <Link to={ROUTES.SIGNUP} className="text-ink font-semibold underline">
            회원가입
          </Link>
        </p>

        {/* env.useMock 은 런타임 값이라 번들에서 사라지지 않습니다.
            계정 정보를 여기 적으면 운영 번들 문자열로 남으므로,
            테스트 계정은 콘솔(setupMocks)과 README 에만 둡니다. */}
        {env.useMock && (
          <p className="surface-sunken text-muted mt-4 rounded-2xl p-3 text-center text-xs">
            목업 데이터로 실행 중입니다. 테스트 계정은 개발자 콘솔을 확인하세요.
          </p>
        )}
      </form>
    </>
  );
}
