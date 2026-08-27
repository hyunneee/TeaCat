import type { User, UserRole } from './auth.types';

/**
 * "이 사용자가 무엇을 할 수 있는가" 판단 로직을 한곳에 모읍니다.
 *
 * 화면 곳곳에 `user?.role === 'ADMIN' || user?.role === 'ORGANIZER'` 를
 * 흩뿌리면 정책이 바뀔 때 전부 찾아 고쳐야 합니다.
 * 이 파일은 순수 함수만 있어서 테스트하기도 쉽습니다.
 */
export const can = {
  /** 티켓을 실제로 사용(입장)할 수 있는가 — 얼굴 등록 필수 */
  useTicket: (user: User | null): boolean => !!user?.faceRegistered,

  /** 공연을 개설할 수 있는가 */
  createConcert: (user: User | null): boolean =>
    !!user && (user.role === 'ORGANIZER' || user.role === 'ADMIN'),

  /** 운영 모니터링 대시보드 접근 */
  viewMonitoring: (user: User | null): boolean => user?.role === 'ADMIN',
};

export function hasRole(user: User | null, ...roles: UserRole[]): boolean {
  return !!user && roles.includes(user.role);
}
