import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select } from '@/shared/components/ui';
import { toast } from '@/shared/stores';
import type { UserRole } from '@/features/auth';
import {
  ROLE_DESCRIPTION,
  ROLE_OPTIONS,
  diffUpdate,
  formatPhone,
  hasChanges,
  isValid,
  validateUpdate,
  type UpdateErrors,
} from '../model/adminUser.model';
import type { AdminUser, AdminUserUpdateRequest } from '../model/adminUser.types';

/**
 * 회원 정보 수정.
 *
 * **바뀐 필드만** 서버로 보냅니다 (`diffUpdate`). 안 바뀐 닉네임까지 보내면
 * 서버의 중복 검사가 자기 닉네임에 걸립니다.
 *
 * 이메일은 수정하지 않습니다 — 로그인 아이디이자 SSAFY 계정 연결의 기준값이라
 * 바꾸면 연결이 끊깁니다. 읽기 전용으로만 보여줍니다.
 */
export interface AdminUserEditModalProps {
  /** null 이면 닫힘 */
  user: AdminUser | null;
  onClose: () => void;
  onSubmit: (userId: number, body: AdminUserUpdateRequest) => void;
  isPending: boolean;
}

export function AdminUserEditModal({
  user,
  onClose,
  onSubmit,
  isPending,
}: AdminUserEditModalProps) {
  const [form, setForm] = useState<AdminUserUpdateRequest>({});
  const [errors, setErrors] = useState<UpdateErrors>({});

  /* 대상이 바뀌면 폼을 그 회원 값으로 다시 채웁니다.
     안 하면 A 를 열었다 닫고 B 를 열었을 때 A 의 입력이 남아 B 에 저장됩니다. */
  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      nickname: user.nickname,
      phone: user.phone,
      role: user.role,
    });
    setErrors({});
  }, [user]);

  const set = <K extends keyof AdminUserUpdateRequest>(
    key: K,
    value: AdminUserUpdateRequest[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = () => {
    if (!user) return;

    const found = validateUpdate(form);
    setErrors(found);
    if (!isValid(found)) return;

    const patch = diffUpdate(user, form);
    if (!hasChanges(patch)) {
      toast.info('바뀐 내용이 없어요.');
      return;
    }

    onSubmit(user.userId, patch);
  };

  const roleChanged = !!form.role && !!user && form.role !== user.role;

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      variant="center"
      width="wide"
      title="회원 정보 수정"
      description={user?.email}
      footer={
        <div className="flex gap-2">
          <Button variant="soft" fullWidth onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button variant="dark" fullWidth onClick={submit} loading={isPending}>
            저장
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          label="역할"
          options={ROLE_OPTIONS}
          value={form.role ?? 'USER'}
          onChange={(role) => set('role', role as UserRole)}
        />
        <p className="text-ink-muted -mt-1 text-xs leading-relaxed">
          {ROLE_DESCRIPTION[form.role ?? 'USER']}
        </p>

        {roleChanged && (
          /* 역할을 바꾸면 서버가 그 회원 세션을 끊습니다. 모르고 바꾸면
             "왜 갑자기 로그아웃됐냐" 는 문의가 옵니다. */
          <p className="bg-surface-2 text-ink rounded-lg px-3 py-2 text-xs leading-relaxed">
            역할을 바꾸면 이 회원은 <strong>모든 기기에서 로그아웃</strong>됩니다. 권한이 토큰에
            담겨 있어 다시 로그인해야 새 권한이 적용돼요.
          </p>
        )}

        <Input
          label="이름"
          autoComplete="off"
          value={form.name ?? ''}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          maxLength={20}
        />

        <Input
          label="닉네임"
          autoComplete="off"
          value={form.nickname ?? ''}
          onChange={(e) => set('nickname', e.target.value.trim())}
          error={errors.nickname}
          maxLength={20}
        />

        <Input
          label="휴대폰 번호"
          inputMode="tel"
          autoComplete="off"
          value={form.phone ?? ''}
          onChange={(e) => set('phone', formatPhone(e.target.value))}
          error={errors.phone}
          maxLength={13}
        />

        <Input
          label="이메일"
          value={user?.email ?? ''}
          readOnly
          disabled
          hint="변경할 수 없습니다."
        />
      </div>
    </Modal>
  );
}
