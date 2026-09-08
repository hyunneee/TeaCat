import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, MonitorSmartphone, Store } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { ROUTES } from '@/shared/constants';
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const logout = useLogout();

  return (
    <div className="min-h-dvh bg-canvas">
      {/* 좁은 화면 안내. lg 이상에서만 대시보드를 보여줍니다.
          🔴 여기서 나가는 버튼이 반드시 있어야 합니다 — 운영 역할은 로그인하면
             이 경로로 바로 오기 때문에, 폰으로 로그인하면 이 화면에 갇힙니다. */}
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center lg:hidden">
        <MonitorSmartphone size={32} className="text-ink-subtle" aria-hidden />
        <p className="text-base font-semibold text-ink">데스크톱에서 열어주세요</p>
        <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
          운영 콘솔은 넓은 화면에 맞춰 만들었어요. 노트북이나 데스크톱 브라우저에서 접속해 주세요.
        </p>
        <Button
          variant="dark"
          size="md"
          leftIcon={<Store size={17} />}
          className="mt-2"
          onClick={() => navigate(ROUTES.HOME)}
        >
          티캣 앱으로 가기
        </Button>
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

            <div className="flex shrink-0 items-center gap-1">
              {/* 콘솔에서 앱으로 나가는 길. 이게 없으면 운영자가 로그아웃 말고는
                  앱으로 돌아갈 방법이 없습니다 (로그인 시 여기로 바로 오기 때문에). */}
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Store size={16} />}
                onClick={() => navigate(ROUTES.HOME)}
              >
                앱으로
              </Button>

              <Button
                variant="ghost"
                size="sm"
                leftIcon={<LogOut size={16} />}
                onClick={() => logout.mutate()}
                loading={logout.isPending}
              >
                로그아웃
              </Button>
            </div>
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
