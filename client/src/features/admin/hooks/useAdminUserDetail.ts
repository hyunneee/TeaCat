import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ROUTES } from '@/shared/constants';
import { useAuth } from '@/features/auth';
import { adminKeys, adminUserApi } from '../api/adminUserApi';
import { rolesWithWallet } from '../model/adminUser.model';
import { useDeleteAdminUserFace, useWithdrawAdminUser } from './useAdminUserMutations';

/** 상세 화면의 탭. 값이 URL 에 나가지 않으므로 화면 안에서만 씁니다 */
export const USER_DETAIL_TABS = [
  { value: 'TICKETS', label: '예매' },
  { value: 'PHOTOCARDS', label: '보유 포카' },
  { value: 'TRADES', label: '포카 거래' },
] as const;

export type UserDetailTab = (typeof USER_DETAIL_TABS)[number]['value'];

/** 확인이 필요한 되돌릴 수 없는 동작 */
type Confirming = 'face' | 'withdraw' | null;

/**
 * 회원 상세 화면의 Controller.
 *
 * 🔴 <b>되돌릴 수 없는 동작이 목록에서 여기로 옮겨왔습니다</b> (얼굴 삭제·탈퇴·캣머니 조정).
 *    목록에서는 행이 촘촘해 옆 사람 버튼을 누르기 쉽고, 누구에게 하는지도 확인하기 어려웠습니다.
 *    상세는 그 회원만 떠 있어서 대상이 분명합니다. 목록에는 자주 쓰는 수정·비밀번호만 남겼습니다.
 *
 * 탈퇴는 <b>성공하면 목록으로 돌아갑니다</b> — 탈퇴시킨 회원의 상세에 그대로 서 있으면
 * 방금 지운 사람을 계속 보게 됩니다.
 */
export function useAdminUserDetail(userId: number) {
  const navigate = useNavigate();
  const { user: me } = useAuth();

  const [tab, setTab] = useState<UserDetailTab>('TICKETS');
  const [adjustingCatMoney, setAdjustingCatMoney] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);

  const user = useQuery({
    queryKey: adminKeys.user(userId),
    queryFn: () => adminUserApi.get(userId),
    // 잘못된 주소로 들어온 경우까지 재시도하면 없는 회원을 한참 기다리게 됩니다
    retry: false,
    enabled: Number.isInteger(userId) && userId > 0,
  });

  const deleteFace = useDeleteAdminUserFace(() => setConfirming(null));
  const withdraw = useWithdrawAdminUser(() => {
    setConfirming(null);
    navigate(ROUTES.ADMIN_USERS, { replace: true });
  });

  const confirm = () => {
    if (confirming === 'face') deleteFace.mutate(userId);
    if (confirming === 'withdraw') withdraw.mutate(userId);
  };

  const data = user.data;

  return {
    user,
    /* 🔴 본인 계정은 서버가 거절합니다(USER_011). 누를 수 있게 두면 눌렀을 때 실패하는
       버튼이 됩니다 — 목록에서와 같은 규칙입니다 */
    isSelf: data ? data.userId === me?.userId : false,
    /** 지갑이 없는 역할(운영진)은 캣머니를 쓰지 않아 서버가 거절합니다 */
    hasWallet: data ? rolesWithWallet.includes(data.role) : false,

    tab,
    setTab,

    adjustingCatMoney,
    openCatMoney: () => setAdjustingCatMoney(true),
    closeCatMoney: () => setAdjustingCatMoney(false),

    confirming,
    askDeleteFace: () => setConfirming('face'),
    askWithdraw: () => setConfirming('withdraw'),
    closeConfirm: () => setConfirming(null),
    confirm,
    isConfirming: deleteFace.isPending || withdraw.isPending,
  };
}
