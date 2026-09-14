import { useState } from 'react';
import { Button, Input, Modal, Select } from '@/shared/components/ui';
import type { UserRole } from '@/features/auth';
import {
  EMPTY_CREATE,
  PASSWORD_RULE_TEXT,
  ROLE_DESCRIPTION,
  ROLE_OPTIONS,
  formatPhone,
  isValid,
  rolesWithWallet,
  validateCreate,
  type CreateErrors,
} from '../model/adminUser.model';
import type { AdminUserCreateRequest } from '../model/adminUser.types';

/**
 * 회원 생성.
 *
 * 모든 역할(USER · ADMIN · STADIUM · PERFORMANCE)을 여기서 만듭니다 —
 * 일반 가입은 항상 USER 라 운영진 계정을 만들 수 있는 유일한 경로입니다.
 *
 * 검증 규칙은 `model/adminUser.model.ts` 에 있고 서버 DTO 와 같은 값입니다.
 * 여기 통과가 서버 통과를 뜻하지는 않습니다 (중복 이메일은 서버만 압니다).
 */
export interface AdminUserCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: AdminUserCreateRequest) => void;
  isPending: boolean;
}

export function AdminUserCreateModal({
  open,
  onClose,
  onSubmit,
  isPending,
}: AdminUserCreateModalProps) {
  const [form, setForm] = useState<AdminUserCreateRequest>(EMPTY_CREATE);
  const [errors, setErrors] = useState<CreateErrors>({});

  const set = <K extends keyof AdminUserCreateRequest>(
    key: K,
    value: AdminUserCreateRequest[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // 고치는 중에 빨간 글씨가 계속 떠 있으면 방해가 됩니다
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const close = () => {
    setForm(EMPTY_CREATE);
    setErrors({});
    onClose();
  };

  const submit = () => {
    const found = validateCreate(form);
    setErrors(found);
    if (!isValid(found)) return;

    onSubmit({ ...form, email: form.email.trim(), name: form.name.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      variant="center"
      width="wide"
      title="회원 생성"
      description="역할을 지정해 계정을 만듭니다. 비밀번호는 만든 뒤 본인이 변경할 수 있어요."
      footer={
        <div className="flex gap-2">
          <Button variant="soft" fullWidth onClick={close} disabled={isPending}>
            취소
          </Button>
          {/* 이 화면의 주 행동이지만 거래는 아니라 dark 입니다 (CLAUDE.md 4-6) */}
          <Button variant="dark" fullWidth onClick={submit} loading={isPending}>
            만들기
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          label="역할"
          options={ROLE_OPTIONS}
          value={form.role}
          onChange={(role) => set('role', role as UserRole)}
        />
        <p className="text-ink-muted -mt-1 text-xs leading-relaxed">
          {ROLE_DESCRIPTION[form.role]}
          {!rolesWithWallet.includes(form.role) && ' 지갑과 캣머니는 발급되지 않습니다.'}
        </p>

        <Input
          label="이메일 (로그인 아이디)"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="staff@teacat.site"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          error={errors.email}
          maxLength={60}
        />

        <Input
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          placeholder={PASSWORD_RULE_TEXT}
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          error={errors.password}
          maxLength={20}
        />

        <Input
          label="이름"
          hint="입장 시 신분 확인에 쓰입니다."
          autoComplete="off"
          placeholder="실명"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          maxLength={20}
        />

        <Input
          label="닉네임"
          placeholder="한글·영문·숫자 2~20자"
          autoComplete="off"
          value={form.nickname}
          onChange={(e) => set('nickname', e.target.value.trim())}
          error={errors.nickname}
          maxLength={20}
        />

        <Input
          label="휴대폰 번호"
          inputMode="tel"
          autoComplete="off"
          placeholder="010-0000-0000"
          value={form.phone}
          onChange={(e) => set('phone', formatPhone(e.target.value))}
          error={errors.phone}
          maxLength={13}
        />
      </div>
    </Modal>
  );
}
