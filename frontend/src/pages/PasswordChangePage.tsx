import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Input } from '@/shared/components/ui';
import { useChangePassword } from '@/features/auth';

export function PasswordChangePage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const change = useChangePassword();

  const mismatch = confirm.length > 0 && next !== confirm;
  const valid = current && next.length >= 8 && !mismatch;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    change.mutate({ currentPassword: current, newPassword: next });
  };

  return (
    <>
      <Header title="비밀번호 변경" showBack />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 pt-6">
        <Input
          label="현재 비밀번호"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          leftIcon={<KeyRound size={16} />}
        />
        <Input
          label="새 비밀번호"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          hint="8자 이상 입력하세요."
        />
        <Input
          label="새 비밀번호 확인"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={mismatch ? '비밀번호가 일치하지 않아요.' : null}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          className="mt-2"
          disabled={!valid}
          loading={change.isPending}
        >
          변경하기
        </Button>
      </form>
    </>
  );
}
