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
 * 티켓이 유효하려면(입장하려면) 얼굴 등록이 선행돼야 하므로 예매 진입 전에 막습니다.
 */
export function RequireFace() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader />;
  if (!can.useTicket(user)) {
    // 등록을 마치면 원래 가려던 곳으로 되돌려 보냅니다. (useFaceRegistration)
    return <Navigate to={ROUTES.FACE_REGISTER} state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/**
 * OTP 인증 통과 필요 (플로우차트: 공연 상세 → OTP 인증 → 구역).
 *
 * 클라이언트 상태는 UX 를 위한 것이고, 진짜 검증은 서버가 합니다.
 * (목업/실서버 모두 좌석 선점 API 에서 OTP_REQUIRED 를 던집니다)
 */
export function RequireOtp() {
  const { scheduleId = '' } = useParams();
  const verifiedFor = useAuthStore((s) => s.otpVerifiedFor);

  if (verifiedFor !== scheduleId) {
    return <Navigate to={ROUTES.BOOKING_OTP(scheduleId)} replace />;
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
