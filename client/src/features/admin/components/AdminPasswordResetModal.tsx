import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/shared/components/ui';
import { PASSWORD_RULE_TEXT, validateNewPassword } from '../model/adminUser.model';
import type { AdminUser } from '../model/adminUser.types';

/**
 * 비밀번호 초기화.
 *
 * 현재 비밀번호를 묻지 않으므로 서버가 그 회원의 세션을 전부 끊습니다.
 * 관리자가 그 사실을 알고 눌러야 해서 안내를 함께 띄웁니다.
 */
export interface AdminPasswordResetModalProps {
  /** null 이면 닫힘 */
  user: AdminUser | null;
  onClose: () => void;
  onSubmit: (userId: number, newPassword: string) => void;
  isPending: boolean;
}

export function AdminPasswordResetModal({
  user,
  onClose,
  onSubmit,
  isPending,
}: AdminPasswordResetModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 대상이 바뀌면 앞 사람에게 입력한 값이 남아 있지 않게 비웁니다
  useEffect(() => {
    setPassword('');
    setError(null);
  }, [user]);

  const submit = () => {
    if (!user) return;

    const found = validateNewPassword(password);
    setError(found);
    if (found) return;

    onSubmit(user.userId, password);
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      variant="center"
      width="wide"
      title="비밀번호 초기화"
      description={user ? `${user.nickname} (${user.email})` : undefined}
      footer={
        <div className="flex gap-2">
          <Button variant="soft" fullWidth onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button variant="dark" fullWidth onClick={submit} loading={isPending}>
            초기화
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink">
          이 회원은 <strong>모든 기기에서 로그아웃</strong>됩니다. 새 비밀번호를 회원에게 직접
          전달하고, 로그인한 뒤 본인이 바꾸도록 안내해 주세요.
        </p>

        <Input
          label="새 비밀번호"
          type="password"
          autoComplete="new-password"
          placeholder={PASSWORD_RULE_TEXT}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          error={error}
          maxLength={20}
        />
      </div>
    </Modal>
  );
}
