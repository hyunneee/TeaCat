import { useState } from 'react';
import { useAuth } from '@/features/auth';
import {
  useCreateAdminUser,
  useDeleteAdminUserFace,
  useResetAdminUserPassword,
  useUpdateAdminUser,
  useWithdrawAdminUser,
} from './useAdminUserMutations';
import { useAdminUsers } from './useAdminUsers';
import type { AdminUser } from '../model/adminUser.types';

/** 확인이 필요한 되돌릴 수 없는 동작 */
type Confirming = { kind: 'face' | 'withdraw'; user: AdminUser } | null;

/**
 * 유저 관리 화면의 Controller.
 *
 * 목록 조회·모달 상태·mutation 을 한 곳에 묶습니다. 페이지는 이 훅 하나를
 * 불러 컴포넌트에 내려주기만 합니다 (CLAUDE.md 3-6 — 페이지에 로직 금지).
 *
 * 모달이 열려 있는지는 **대상 회원 객체**로 표현합니다. boolean 과 대상을
 * 따로 들면 "열렸는데 대상이 없는" 상태가 생깁니다.
 */
export function useAdminUserManagement() {
  const { user: me } = useAuth();
  const list = useAdminUsers();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  /* 캣머니 조정(테스트용). 모달이 자기 잔액 조회와 조정을 직접 들고 있어
     여기서는 "누구를 열었는가" 만 압니다 */
  const [adjustingCatMoney, setAdjustingCatMoney] = useState<AdminUser | null>(null);

  const create = useCreateAdminUser(() => setCreating(false));
  const update = useUpdateAdminUser(() => setEditing(null));
  const resetPassword = useResetAdminUserPassword(() => setResetting(null));
  const deleteFace = useDeleteAdminUserFace(() => setConfirming(null));
  const withdraw = useWithdrawAdminUser(() => setConfirming(null));

  const confirm = () => {
    if (!confirming) return;

    if (confirming.kind === 'face') deleteFace.mutate(confirming.user.userId);
    else withdraw.mutate(confirming.user.userId);
  };

  return {
    me,
    list,

    /* 열기 */
    openCreate: () => setCreating(true),
    openEdit: setEditing,
    openResetPassword: setResetting,
    openDeleteFace: (user: AdminUser) => setConfirming({ kind: 'face', user }),
    openWithdraw: (user: AdminUser) => setConfirming({ kind: 'withdraw', user }),
    openCatMoney: setAdjustingCatMoney,

    /* 상태 */
    creating,
    editing,
    resetting,
    confirming,
    adjustingCatMoney,

    /* 닫기 */
    closeCreate: () => setCreating(false),
    closeEdit: () => setEditing(null),
    closeResetPassword: () => setResetting(null),
    closeConfirm: () => setConfirming(null),
    closeCatMoney: () => setAdjustingCatMoney(null),

    /* 실행 */
    create,
    update,
    resetPassword,
    confirm,
  };
}
