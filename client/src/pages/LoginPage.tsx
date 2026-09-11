import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Input, Logo } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
import { SsafyLoginButton, useLogin } from '@/features/auth';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <>
      <Header showBack />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        <div className="mb-2 flex flex-col items-center gap-3 py-4">
          <Logo size={52} />
          <p className="text-subtle text-sm">암표 없는 티켓팅</p>

          {/* SAFE·TYCAT·CH — 한 단어 안에 서비스 이름(TYCAT)이 들어 있습니다.
              그 부분만 강조색으로 칠해 "안전하게 잡는다"와 이름을 한 번에 읽힙니다.
              강조색이 글자에 쓰이는 **유일한 자리**입니다 (로고 취급). */}
          <p className="text-lg font-extrabold tracking-[0.14em]">
            SAFE<span className="text-accent-700">TYCAT</span>CH
          </p>
        </div>

        <Input
          label="이메일"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          leftIcon={<Mail size={17} />}
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
          disabled={!email || !password}
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
      </form>
    </>
  );
}
