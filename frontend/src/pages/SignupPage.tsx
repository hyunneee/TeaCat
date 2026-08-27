import { useState, type FormEvent } from 'react';
import { Header } from '@/shared/components/layout';
import { Button, Input } from '@/shared/components/ui';
import { useSignup } from '@/features/auth';

const EMPTY = { loginId: '', password: '', passwordConfirm: '', name: '', phone: '', email: '' };

export function SignupPage() {
  const [form, setForm] = useState(EMPTY);
  const signup = useSignup();

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const mismatch = form.passwordConfirm.length > 0 && form.password !== form.passwordConfirm;
  const valid =
    form.loginId && form.password && form.name && form.phone && form.email && !mismatch;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const { passwordConfirm: _ignored, ...body } = form;
    signup.mutate(body);
  };

  return (
    <>
      <Header title="회원가입" showBack />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 pt-6">
        <Input
          label="아이디"
          value={form.loginId}
          onChange={set('loginId')}
          placeholder="영문/숫자 4자 이상"
          autoComplete="username"
          hint="티켓을 주고받을 때 쓰는 식별자입니다."
        />
        <Input
          label="비밀번호"
          type="password"
          value={form.password}
          onChange={set('password')}
          autoComplete="new-password"
        />
        <Input
          label="비밀번호 확인"
          type="password"
          value={form.passwordConfirm}
          onChange={set('passwordConfirm')}
          autoComplete="new-password"
          error={mismatch ? '비밀번호가 일치하지 않아요.' : null}
        />
        <Input label="이름" value={form.name} onChange={set('name')} autoComplete="name" />
        <Input
          label="휴대폰 번호"
          value={form.phone}
          onChange={set('phone')}
          placeholder="010-0000-0000"
          inputMode="tel"
          autoComplete="tel"
          hint="예매 시 본인 확인(OTP)에 사용됩니다."
        />
        <Input
          label="이메일"
          type="email"
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
          hint="취소표 추첨 당첨 안내를 받습니다."
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          className="mt-2"
          loading={signup.isPending}
          disabled={!valid}
        >
          가입하기
        </Button>
      </form>
    </>
  );
}
