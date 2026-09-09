import {
  Armchair,
  Building2,
  CalendarPlus,
  ChartLine,
  ScanFace,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { ROUTES } from '@/shared/constants';
import { Badge } from '@/shared/components/ui';
import {
  BentoGrid,
  BentoTile,
  StatTile,
  ROLE_LABEL,
  USER_ROLES,
  useAdminUserStats,
} from '@/features/admin';
import { can, useAuth } from '@/features/auth';

/**
 * 어드민 대시보드 (벤토 그리드).
 *
 * 페이지는 조립만 합니다 — 훅 호출 → 컴포넌트 배치 (CLAUDE.md 3-6).
 *
 * 🔴 타일을 추가할 때는 `<BentoTile span={...}>` 을 하나 더 놓으면 됩니다.
 *    12칸 기준이라 합이 12를 넘으면 자동으로 다음 줄로 갑니다.
 */
export function AdminDashboardPage() {
  const { user } = useAuth();
  const canManageUsers = can.manageUsers(user);
  const canManageStadiumLayouts = can.manageStadiumLayouts(user);

  // 회원 통계는 ADMIN 전용 API 입니다. 다른 역할이 부르면 403 이라 아예 안 부릅니다
  const { data: stats } = useAdminUserStats();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-ink text-lg font-bold">대시보드</h1>
        <p className="text-ink-muted text-sm">
          {user?.nickname}님, 오늘 운영 상태를 한눈에 확인하세요.
        </p>
      </div>

      <BentoGrid>
        {canManageUsers ? (
          <>
            <StatTile label="전체 회원" value={stats?.total} unit="명" icon={Users} />
            <StatTile
              label="얼굴 등록"
              value={stats?.faceRegistered}
              unit="명"
              icon={ScanFace}
              caption="티켓 사용(입장)의 전제 조건"
            />
            <StatTile
              label="최근 7일 가입"
              value={stats?.joinedLast7Days}
              unit="명"
              icon={CalendarPlus}
            />
            <StatTile
              label="운영진 계정"
              value={stats && stats.byRole.ADMIN + stats.byRole.STADIUM + stats.byRole.PERFORMANCE}
              unit="명"
              icon={ShieldCheck}
            />

            <BentoTile
              span={4}
              title="유저 관리"
              description="회원을 검색하고 역할·정보를 수정하거나 새 계정을 만듭니다."
              icon={UserPlus}
              to={ROUTES.ADMIN_USERS}
            >
              <div className="flex flex-wrap gap-1.5">
                {USER_ROLES.map((role) => (
                  <Badge key={role} tone={role === 'USER' ? 'quiet' : 'accent'}>
                    {ROLE_LABEL[role]} {stats?.byRole[role] ?? '—'}
                  </Badge>
                ))}
              </div>
            </BentoTile>

            {/* 🔴 타일을 추가할 자리입니다. span 은 12칸 기준이고, 합이 12를
                   넘으면 자동으로 다음 줄로 넘어갑니다. */}
            <BentoTile
              span={4}
              title="공연장 목록"
              description="등록된 공연장과 기본 정보를 조회하고 저장된 좌석 배치를 관리합니다."
              icon={Building2}
              to={ROUTES.ADMIN_STADIUMS}
            />

            <BentoTile
              span={4}
              title="운영 통계"
              description="일자별 가입·탈퇴와 하루 접속자를 꺾은선으로 봅니다. 운영 배포 시점이 함께 표시됩니다."
              icon={ChartLine}
              to={ROUTES.ADMIN_ANALYTICS}
            />

            <BentoTile
              span={4}
              title="좌석 배치 관리"
              description="공연장을 검색하고 Excel 좌석표에서 구역·좌석·고정 요소를 검수해 새 배치를 생성합니다."
              icon={Armchair}
              to={ROUTES.ADMIN_STADIUM}
            />
          </>
        ) : canManageStadiumLayouts ? (
          <>
            <BentoTile
              span={6}
              title="공연장 목록"
              description="담당 공연장과 저장된 좌석 배치를 조회하고 관리합니다."
              icon={Building2}
              to={ROUTES.ADMIN_STADIUMS}
            />
            <BentoTile
              span={6}
              title="좌석 배치 관리"
              description="담당 공연장의 좌석 배치를 조회하고 Excel 기반 새 배치를 생성합니다."
              icon={Armchair}
              to={ROUTES.ADMIN_STADIUM}
            />
          </>
        ) : (
          <BentoTile
            span={12}
            title="아직 사용할 수 있는 관리 기능이 없어요"
            description={`${user ? ROLE_LABEL[user.role] : ''} 역할로 쓸 수 있는 화면이 준비되면 왼쪽 메뉴에 나타납니다.`}
            icon={ShieldCheck}
          />
        )}
      </BentoGrid>
    </div>
  );
}
