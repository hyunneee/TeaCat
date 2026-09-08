import type { User, UserRole } from './auth.types';

/**
 * "이 사용자가 무엇을 할 수 있는가" 판단 로직을 한곳에 모읍니다.
 *
 * 화면 곳곳에 역할 비교문을 흩뿌리면 정책이 바뀔 때 전부 찾아 고쳐야 합니다.
 * 이 파일은 순수 함수만 있어서 테스트하기도 쉽습니다.
 */
export const can = {
  /** 티켓을 실제로 사용(입장)할 수 있는가 — 얼굴 등록 필수 */
  useTicket: (user: User | null): boolean => !!user?.faceRegistered,

  /**
   * 공연을 개설할 수 있는가.
   *
   * 서버의 공연 관리 API(`/admin/**`)는 ADMIN 만 허용합니다 (`SecurityConfig`).
   * 여기서 PERFORMANCE·STADIUM 까지 열어두면 버튼은 보이는데 서버가 403 을 주는 화면이 됩니다.
   * 서버가 주최자 역할을 받기 시작하면 여기만 함께 넓히면 됩니다.
   */
  createConcert: (user: User | null): boolean => user?.role === 'ADMIN',

  /** 등록한 공연을 수정·삭제할 수 있는가 — 지금은 등록 권한과 같습니다 */
  manageConcert: (user: User | null): boolean => user?.role === 'ADMIN',

  /** 운영 모니터링 대시보드 접근 */
  viewMonitoring: (user: User | null): boolean => user?.role === 'ADMIN',
};

export function hasRole(user: User | null, ...roles: UserRole[]): boolean {
  return !!user && roles.includes(user.role);
}
