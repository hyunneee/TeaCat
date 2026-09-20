import { FEATURE } from '@/shared/constants';
import type { User, UserRole } from './auth.types';

/**
 * "이 사용자가 무엇을 할 수 있는가" 판단 로직을 한곳에 모읍니다.
 *
 * 화면 곳곳에 역할 비교문을 흩뿌리면 정책이 바뀔 때 전부 찾아 고쳐야 합니다.
 * 이 파일은 순수 함수만 있어서 테스트하기도 쉽습니다.
 */
export const can = {
  /** 포카 콘텐츠 관리 API는 ADMIN 전용이다. */
  managePocaContent: (user: User | null): boolean => user?.role === 'ADMIN',
  /**
   * 티켓을 실제로 사용(입장)할 수 있는가 — 얼굴 등록 필수.
   *
   * 🔴 얼굴을 닫아 둔 배포(`FEATURE.face === false`)에서는 **항상 true** 입니다.
   *    등록할 방법이 없는데 등록을 요구하면 아무도 예매를 못 합니다.
   *    예매 가드(`RequireFace`)·예매 완료·티켓 상세가 전부 이 한 줄을 보므로,
   *    기능을 여닫을 때 화면을 하나씩 찾아다닐 필요가 없습니다.
   */
  useTicket: (user: User | null): boolean => !FEATURE.face || !!user?.faceRegistered,

  /**
   * 지금 얼굴로 본인 확인을 할 수 있는가 (티켓 상세의 "본인 확인").
   *
   * `useTicket` 과 **반대로** 움직입니다 — 닫아 둔 배포에서는 항상 false 입니다.
   * 저쪽은 "막지 마라", 이쪽은 "보여주지 마라" 라서 한 함수로 묶을 수 없습니다.
   */
  /**
   * 게이트 입장 확인 메뉴 (`/admin/check-in`).
   *
   * ADMIN과 공연 기획자가 사용하며, 서버에서 담당 공연의 회차인지 검사합니다.
   * 🔴 얼굴을 닫아 둔 배포(`FEATURE.face === false`)에서는 **보이지 않습니다** —
   *    대조할 얼굴을 아무도 등록하지 않았으므로 검표를 할 수가 없습니다.
   */
  checkIn: (user: User | null): boolean => FEATURE.face && hasRole(user, 'ADMIN', 'PERFORMANCE'),

  /**
   * 공연을 개설할 수 있는가 — 관리자와 공연 주최자.
   *
   * 서버의 공연 관리 API(`/admin/concerts/**` 등)가 허용하는 역할과 **같아야** 합니다 (`SecurityConfig`).
   * 여기만 넓히면 버튼은 보이는데 서버가 403 을 주는 화면이 됩니다. STADIUM 은 공연장 운영자라 공연을 개설하지 않습니다.
   */
  createConcert: (user: User | null): boolean => hasRole(user, 'ADMIN', 'PERFORMANCE'),

  /** 공연 관리 화면에 들어갈 수 있는 역할인가. 개별 공연을 다룰 수 있는지는 `manageThisConcert` 가 봅니다 */
  manageConcert: (user: User | null): boolean => hasRole(user, 'ADMIN', 'PERFORMANCE'),

  /**
   * **이** 공연을 수정·삭제할 수 있는가.
   *
   * | 역할 | 범위 |
   * |---|---|
   * | `ADMIN` | 모든 공연 — 전체 관리자 |
   * | `PERFORMANCE` | 자기가 등록한 것만 |
   *
   * 서버의 판정(`AdminPerformanceService.getManageablePerformance`)과 **같아야** 합니다.
   * 여기만 넓히면 버튼은 보이는데 눌러도 403(`PERFORMANCE_020`) 만 나는 화면이 됩니다.
   *
   * 등록자를 알 수 없는 옛 공연(`createdBy === null`)은 주최자는 못 다루고 ADMIN 만 다룹니다.
   */
  manageThisConcert: (user: User | null, concert: { createdBy: number | null }): boolean => {
    if (!can.manageConcert(user)) return false;
    if (user?.role === 'ADMIN') return true;
    return concert.createdBy != null && concert.createdBy === user?.userId;
  },

  /** 운영 모니터링 대시보드 접근 */
  viewMonitoring: (user: User | null): boolean => user?.role === 'ADMIN',

  /**
   * 어드민 대시보드(`/admin`) 자체에 들어갈 수 있는가.
   *
   * 일반 회원(USER)과 비로그인은 못 들어옵니다. 운영 역할 셋은 들어오고,
   * 안에서 무엇이 보이는지는 아래 메뉴별 권한이 각각 정합니다.
   */
  accessAdmin: (user: User | null): boolean => hasRole(user, 'ADMIN', 'STADIUM', 'PERFORMANCE'),

  /**
   * 회원 관리 메뉴.
   *
   * 서버의 `/admin/users/**` 는 ADMIN 전용입니다 (`SecurityConfig`).
   * STADIUM·PERFORMANCE 에게 열어두면 메뉴는 보이는데 403 이 나는 화면이 됩니다.
   */
  manageUsers: (user: User | null): boolean => user?.role === 'ADMIN',

  /**
   * 메인 배너 관리 메뉴.
   *
   * 서버의 `/admin/banners/**` 는 ADMIN 전용입니다 (`SecurityConfig` 의 포괄 규칙).
   */
  manageBanners: (user: User | null): boolean => user?.role === 'ADMIN',

  /**
   * 운영 통계 메뉴 — 가입·접속 추이.
   *
   * 서버의 `/admin/analytics/**` 는 ADMIN 전용입니다 (`SecurityConfig` 의 포괄 규칙).
   */
  viewAnalytics: (user: User | null): boolean => user?.role === 'ADMIN',

  /**
   * 문의 관리 메뉴 — 답변·해결 처리.
   *
   * 서버의 `/admin/inquiries/**` 는 ADMIN 전용입니다 (`SecurityConfig` 의 포괄 규칙).
   */
  manageInquiries: (user: User | null): boolean => user?.role === 'ADMIN',

  /** 공연장·구역·좌석 배치 관리. 서버 정책과 같이 ADMIN 및 STADIUM 역할에 허용합니다. */
  manageStadiumLayouts: (user: User | null): boolean => hasRole(user, 'ADMIN', 'STADIUM'),
};

export function hasRole(user: User | null, ...roles: UserRole[]): boolean {
  return !!user && roles.includes(user.role);
}
