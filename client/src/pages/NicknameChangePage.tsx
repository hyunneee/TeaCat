import { useState, type FormEvent } from 'react';
import { UserRound } from 'lucide-react';
import { Header } from '@/shared/components/layout';
import { Button, Input } from '@/shared/components/ui';
import { useAuth, useChangeNickname } from '@/features/auth';

export function NicknameChangePage() {
  const { user } = useAuth();
  const [nickname, setNickname] = useState('');
  const change = useChangeNickname();

  const trimmed = nickname.trim();
  const same = trimmed.length > 0 && trimmed === user?.nickname;
  const valid = trimmed.length >= 2 && !same;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    change.mutate({ nickname: trimmed });
  };

  return (
    <>
      <Header title="닉네임 변경" showBack />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 pt-6">
        <Input
          label="현재 닉네임"
          value={user?.nickname ?? ''}
          readOnly
          disabled
          leftIcon={<UserRound size={16} />}
        />
        <Input
          label="새 닉네임"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="한글·영문·숫자 2~20자"
          autoComplete="nickname"
          maxLength={20}
          hint="티켓을 주고받을 때 쓰는 이름입니다."
          error={same ? '지금 쓰고 있는 닉네임이에요.' : null}
        />

        <Button
          variant="dark"
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
