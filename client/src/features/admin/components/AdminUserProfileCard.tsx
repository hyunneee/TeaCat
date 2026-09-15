import { Coins, ScanFace, UserMinus } from 'lucide-react';
import { Badge, Button, Card } from '@/shared/components/ui';
import { formatDateTime } from '@/shared/lib';
import { ROLE_LABEL } from '../model/adminUser.model';
import type { AdminUser } from '../model/adminUser.types';

/**
 * 회원 상세 머리 — 누구인지와, 그 사람에게 할 수 있는 일.
 *
 * 🔴 <b>되돌릴 수 없는 동작이 목록에서 여기로 옮겨왔습니다.</b> 목록은 행이 촘촘해 옆 사람 줄을
 * 누르기 쉽고 "누구에게 하는지" 를 확인할 방법이 행 하나뿐이었습니다. 여기서는 그 회원만
 * 떠 있어 대상이 분명합니다.
 *
 * 서버를 모릅니다 — props 로 받은 것만 그립니다 (CLAUDE.md 4-3).
 */
export interface AdminUserProfileCardProps {
  user: AdminUser;
  /** 본인 계정이면 서버가 거절합니다 (USER_011) — 아예 버튼을 감춥니다 */
  isSelf: boolean;
  /** 지갑이 있는 역할(USER)만 캣머니를 씁니다 */
  hasWallet: boolean;
  onAdjustCatMoney: () => void;
  onDeleteFace: () => void;
  onWithdraw: () => void;
}

export function AdminUserProfileCard({
  user,
  isSelf,
  hasWallet,
  onAdjustCatMoney,
  onDeleteFace,
  onWithdraw,
}: AdminUserProfileCardProps) {
  return (
    <Card className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-ink text-lg font-bold">{user.nickname}</h2>
          <Badge tone={user.role === 'USER' ? 'quiet' : 'accent'}>{ROLE_LABEL[user.role]}</Badge>
          {user.faceRegistered && <Badge tone="neutral">얼굴 등록</Badge>}
          {user.socialOnly && <Badge tone="quiet">SSAFY 계정</Badge>}
        </div>

        <dl className="text-ink-muted mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-subtle text-xs">이름</dt>
          <dd className="text-ink">{user.name}</dd>
          <dt className="text-ink-subtle text-xs">이메일</dt>
          <dd className="break-all">{user.email}</dd>
          <dt className="text-ink-subtle text-xs">연락처</dt>
          <dd className="tabular-nums">{user.phone}</dd>
          <dt className="text-ink-subtle text-xs">가입</dt>
          <dd className="tabular-nums">{formatDateTime(user.createdAt)}</dd>
        </dl>
      </div>

      {isSelf ? (
        /* 본인 계정은 서버가 거절합니다. 누를 수 있게 두면 눌렀을 때 실패하는 버튼이 됩니다 */
        <p className="text-ink-subtle text-xs">본인 계정은 마이페이지에서 변경하세요</p>
      ) : (
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {/* 지갑이 없는 역할(운영진)은 서버가 거절합니다 */}
          {hasWallet && (
            <Button
              variant="soft"
              size="md"
              leftIcon={<Coins size={15} />}
              onClick={onAdjustCatMoney}
            >
              캣머니 조정
            </Button>
          )}

          {/* 되돌릴 수 없는 동작은 붉게 (CLAUDE.md 4-7) */}
          {user.faceRegistered && (
            <Button
              variant="danger-ghost"
              size="md"
              leftIcon={<ScanFace size={15} />}
              onClick={onDeleteFace}
            >
              얼굴 삭제
            </Button>
          )}

          <Button
            variant="danger-ghost"
            size="md"
            leftIcon={<UserMinus size={15} />}
            onClick={onWithdraw}
          >
            탈퇴 처리
          </Button>
        </div>
      )}
    </Card>
  );
}
