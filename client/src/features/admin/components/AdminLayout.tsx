import { Outlet } from 'react-router-dom';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { ROLE_LABEL } from '../model/adminUser.model';
import { AdminSidebar } from './AdminSidebar';
import { useAuth, useLogout } from '@/features/auth';

/**
 * 어드민 대시보드의 껍데기.
 *
 * 🔴 **데스크톱 전용입니다.** 앱 화면(`AppLayout`/`PlainLayout`)의 `.app-width`
 *    한 기둥 레이아웃을 쓰지 않고 화면을 꽉 씁니다. 표와 사이드바를 336px 안에
 *    넣을 수 없기 때문입니다. (client/CLAUDE.md 8장)
 *
 *    좁은 화면에서는 반응형으로 접지 않고 **안내를 띄웁니다.** 어설프게 반응형을
 *    넣으면 폰에서 쓸 수 있는 것처럼 보이는데 실제로는 표가 못 읽힙니다.
 *
 * 접근 제어는 라우터의 `RequireRole` 이 이미 끝냈습니다 — 여기서 다시 막지 않습니다.
 */
export function AdminLayout() {
  const { user } = useAuth();
  const logout = useLogout();

  return (
    <div className="min-h-dvh bg-canvas">
      {/* 좁은 화면 안내. lg 이상에서만 대시보드를 보여줍니다 */}
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center lg:hidden">
        <MonitorSmartphone size={32} className="text-ink-subtle" aria-hidden />
        <p className="text-base font-semibold text-ink">데스크톱에서 열어주세요</p>
        <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
          운영 콘솔은 넓은 화면에 맞춰 만들었어요. 노트북이나 데스크톱 브라우저에서 접속해 주세요.
        </p>
      </div>

      <div className="hidden lg:flex lg:min-h-dvh">
        <AdminSidebar user={user} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface-1 px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user?.nickname}</p>
              <p className="truncate text-xs text-ink-muted">
                {user ? ROLE_LABEL[user.role] : ''} · {user?.email}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LogOut size={16} />}
              onClick={() => logout.mutate()}
              loading={logout.isPending}
            >
              로그아웃
            </Button>
          </header>

          {/* min-w-0 이 있어야 안쪽 표가 넘칠 때 사이드바를 밀지 않고 자기가 스크롤합니다 */}
          <main className="min-w-0 flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
