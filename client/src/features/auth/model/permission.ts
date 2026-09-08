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
   * 공연을 개설할 수 있는가 — 관리자와 공연 주최자.
   *
   * 서버의 공연 관리 API(`/admin/concerts/**` 등)가 허용하는 역할과 **같아야** 합니다 (`SecurityConfig`).
   * 여기만 넓히면 버튼은 보이는데 서버가 403 을 주는 화면이 됩니다. STADIUM 은 공연장 운영자라 공연을 개설하지 않습니다.
   */
  createConcert: (user: User | null): boolean => hasRole(user, 'ADMIN', 'PERFORMANCE'),

  /** 등록한 공연을 수정·삭제할 수 있는가 — 역할은 등록 권한과 같고, 본인 것인지는 화면이 따로 봅니다(createdBy) */
  manageConcert: (user: User | null): boolean => hasRole(user, 'ADMIN', 'PERFORMANCE'),

  /** 운영 모니터링 대시보드 접근 */
  viewMonitoring: (user: User | null): boolean => user?.role === 'ADMIN',

  /**
   * 어드민 대시보드(`/admin`) 자체에 들어갈 수 있는가.
   *
   * 일반 회원(USER)과 비로그인은 못 들어옵니다. 운영 역할 셋은 들어오고,
   * 안에서 무엇이 보이는지는 아래 메뉴별 권한이 각각 정합니다.
   */
  accessAdmin: (user: User | null): boolean =>
    hasRole(user, 'ADMIN', 'STADIUM', 'PERFORMANCE'),

  /**
   * 회원 관리 메뉴.
   *
   * 서버의 `/admin/users/**` 는 ADMIN 전용입니다 (`SecurityConfig`).
   * STADIUM·PERFORMANCE 에게 열어두면 메뉴는 보이는데 403 이 나는 화면이 됩니다.
   */
  manageUsers: (user: User | null): boolean => user?.role === 'ADMIN',

  /** 공연장·구역·좌석 배치 관리. 서버 정책과 같이 ADMIN 및 STADIUM 역할에 허용합니다. */
  manageStadiumLayouts: (user: User | null): boolean =>
    hasRole(user, 'ADMIN', 'STADIUM'),
};

export function hasRole(user: User | null, ...roles: UserRole[]): boolean {
  return !!user && roles.includes(user.role);
}
