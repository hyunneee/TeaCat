import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { ROUTES } from '@/shared/constants';
import { PageLoader } from '@/shared/components/common';
import { can, hasRole, useAuth, useAuthStore, type UserRole } from '@/features/auth';

/**
 * 라우트 가드.
 *
 * "이 페이지 들어가도 되나?" 를 페이지마다 useEffect 로 검사하지 않습니다.
 * 라우터 설정에서 감싸기만 하면 되고, 정책이 바뀌면 이 파일만 고칩니다.
 */

/** 로그인 필요 */
export function RequireAuth() {
  const { isLoggedIn, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader />;

  // 로그인 후 원래 가려던 곳으로 되돌려보내기 위해 현재 위치를 기억합니다.
  if (!isLoggedIn) return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;

  return <Outlet />;
}

/**
 * 얼굴 등록 필요.
 *
 * 얼굴은 **마이페이지에서 한 번만** 등록합니다. 예매할 때마다 찍는 게 아니라,
 * 예매하면 등록해 둔 얼굴이 그 티켓에 매칭됩니다.
 * 그래서 미등록이면 예매 진입을 막고 **마이페이지로** 보냅니다.
 * (예매 흐름 한가운데서 카메라를 켜라고 하면 그 자리에서 이탈합니다)
 */
export function RequireFace() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!can.useTicket(user)) {
    // 마이페이지가 state 를 보고 왜 튕겼는지 안내합니다.
    return <Navigate to={ROUTES.MY} state={{ faceRequired: true }} replace />;
  }

  return <Outlet />;
}

/**
 * 자동입력 방지 통과 필요 (플로우차트: 공연 상세 → 봇 확인 → 구역).
 *
 * 클라이언트 상태는 UX 를 위한 것이고, 진짜 검증은 서버가 합니다.
 * (목업/실서버 모두 좌석 선점 API 에서 CAPTCHA_REQUIRED 를 던집니다)
 */
export function RequireCaptcha() {
  const { scheduleId = '' } = useParams();
  const verifiedFor = useAuthStore((s) => s.captchaVerifiedFor);

  if (verifiedFor !== scheduleId) {
    return <Navigate to={ROUTES.BOOKING_VERIFY(scheduleId)} replace />;
  }

  return <Outlet />;
}

/** 특정 권한 필요 (소속사 / 운영자) */
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!hasRole(user, ...roles)) return <Navigate to={ROUTES.HOME} replace />;

  return <Outlet />;
}
