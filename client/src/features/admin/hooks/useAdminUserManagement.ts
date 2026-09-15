import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/shared/constants';
import { useAuth } from '@/features/auth';
import {
  useCreateAdminUser,
  useResetAdminUserPassword,
  useUpdateAdminUser,
} from './useAdminUserMutations';
import { useAdminUsers } from './useAdminUsers';
import type { AdminUser } from '../model/adminUser.types';

/**
 * 유저 관리 **목록** 화면의 Controller.
 *
 * 목록 조회·모달 상태·mutation 을 한 곳에 묶습니다. 페이지는 이 훅 하나를
 * 불러 컴포넌트에 내려주기만 합니다 (CLAUDE.md 3-6 — 페이지에 로직 금지).
 *
 * 모달이 열려 있는지는 **대상 회원 객체**로 표현합니다. boolean 과 대상을
 * 따로 들면 "열렸는데 대상이 없는" 상태가 생깁니다.
 *
 * 🔴 <b>얼굴 삭제·탈퇴·캣머니 조정은 여기 없습니다</b> — 회원 상세로 옮겼습니다
 * ({@link useAdminUserDetail}). 목록은 행이 촘촘해 옆 사람 줄을 누르기 쉬웠고,
 * 되돌릴 수 없는 동작을 그런 자리에 둘 이유가 없습니다. 여기 남은 것은 자주 쓰는
 * 생성·수정·비밀번호뿐입니다.
 */
export function useAdminUserManagement() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const list = useAdminUsers();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);

  const create = useCreateAdminUser(() => setCreating(false));
  const update = useUpdateAdminUser(() => setEditing(null));
  const resetPassword = useResetAdminUserPassword(() => setResetting(null));

  return {
    me,
    list,

    /* 열기 */
    openDetail: (user: AdminUser) => navigate(ROUTES.ADMIN_USER_DETAIL(String(user.userId))),
    openCreate: () => setCreating(true),
    openEdit: setEditing,
    openResetPassword: setResetting,

    /* 상태 */
    creating,
    editing,
    resetting,

    /* 닫기 */
    closeCreate: () => setCreating(false),
    closeEdit: () => setEditing(null),
    closeResetPassword: () => setResetting(null),

    /* 실행 */
    create,
    update,
    resetPassword,
  };
}
