import { KeyRound, Pencil, ScanFace, UserMinus } from 'lucide-react';
import { Badge, Button, Skeleton } from '@/shared/components/ui';
import { EmptyState } from '@/shared/components/common';
import { ROLE_LABEL } from '../model/adminUser.model';
import type { AdminUser } from '../model/adminUser.types';

/**
 * 회원 표.
 *
 * 서버를 모릅니다 — props 로 받은 것만 그립니다 (CLAUDE.md 4-3).
 * 행 동작은 전부 콜백으로 위로 올립니다.
 */
export interface AdminUserTableProps {
  users: AdminUser[];
  isLoading: boolean;
  /** 지금 로그인한 관리자 본인 — 자기 행은 동작 버튼을 숨깁니다 */
  currentUserId: number | undefined;
  onEdit: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onDeleteFace: (user: AdminUser) => void;
  onWithdraw: (user: AdminUser) => void;
}

const HEADERS = ['회원', '연락처', '역할', '얼굴', '가입일', ''] as const;

/** 2026-09-08 */
const formatDate = (iso: string) => iso.slice(0, 10);

export function AdminUserTable({
  users,
  isLoading,
  currentUserId,
  onEdit,
  onResetPassword,
  onDeleteFace,
  onWithdraw,
}: AdminUserTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <EmptyState
        title="조건에 맞는 회원이 없어요"
        description="검색어나 역할 필터를 바꿔보세요."
      />
    );
  }

  return (
    // 표가 좁아지면 안쪽에서 가로 스크롤합니다. 페이지 자체가 밀리면 사이드바가 흔들립니다
    <div className="overflow-x-auto">
      <table className="w-full min-w-3xl border-collapse text-sm">
        <thead>
          <tr className="border-line border-b text-left">
            {HEADERS.map((header, i) => (
              <th
                key={header || `action-${i}`}
                scope="col"
                className="text-ink-muted px-4 py-2.5 text-xs font-medium"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {users.map((user) => {
            const isSelf = user.userId === currentUserId;

            return (
              <tr
                key={user.userId}
                className="border-line/60 hover:bg-surface-2 border-b last:border-0"
              >
                <td className="px-4 py-3">
                  <p className="text-ink font-medium">
                    {user.nickname}
                    {isSelf && <span className="text-ink-subtle ml-1.5 text-xs">(나)</span>}
                  </p>
                  <p className="text-ink-muted text-xs">{user.email}</p>
                </td>

                <td className="px-4 py-3">
                  <p className="text-ink">{user.name}</p>
                  <p className="text-ink-muted text-xs tabular-nums">{user.phone}</p>
                </td>

                <td className="px-4 py-3">
                  <Badge tone={user.role === 'USER' ? 'quiet' : 'accent'}>
                    {ROLE_LABEL[user.role]}
                  </Badge>
                </td>

                <td className="px-4 py-3">
                  {user.faceRegistered ? (
                    <Badge tone="neutral">등록</Badge>
                  ) : (
                    <span className="text-ink-subtle text-xs">미등록</span>
                  )}
                </td>

                <td className="text-ink-muted px-4 py-3 text-xs tabular-nums">
                  {formatDate(user.createdAt)}
                </td>

                <td className="px-4 py-3">
                  {isSelf ? (
                    /* 본인 계정은 서버가 거절합니다 (USER_011). 누를 수 있게 두면
                       눌렀을 때 실패하는 버튼이 됩니다. */
                    <span className="text-ink-subtle text-xs">마이페이지에서 변경</span>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Pencil size={14} />}
                        onClick={() => onEdit(user)}
                      >
                        수정
                      </Button>

                      {/* SSAFY 전용 계정은 비밀번호가 없어 서버가 거절합니다 */}
                      {!user.socialOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<KeyRound size={14} />}
                          onClick={() => onResetPassword(user)}
                        >
                          비번
                        </Button>
                      )}

                      {user.faceRegistered && (
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          leftIcon={<ScanFace size={14} />}
                          onClick={() => onDeleteFace(user)}
                        >
                          얼굴 삭제
                        </Button>
                      )}

                      {/* 되돌릴 수 없는 동작은 붉게 (DESIGN.md 1장 / CLAUDE.md 4-7) */}
                      <Button
                        variant="danger-ghost"
                        size="sm"
                        leftIcon={<UserMinus size={14} />}
                        onClick={() => onWithdraw(user)}
                      >
                        탈퇴
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
