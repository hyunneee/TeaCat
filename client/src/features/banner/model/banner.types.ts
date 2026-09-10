/**
 * 메인 슬라이드(배너).
 *
 * 서버 `GET /banners` 응답 그대로입니다. 노출 중인 것만, 순서대로 옵니다.
 *
 * 링크는 **완성된 주소가 아닙니다.** 공연 배너는 `performanceId` 만 오고 화면이
 * `ROUTES.CONCERT_DETAIL(id)` 로 조립합니다 — 경로 규칙은 프론트가 가진 것이라
 * 서버가 문자열로 박으면 경로를 바꿀 때 서버까지 고쳐야 합니다. (CLAUDE.md 3-5)
 */
export interface Banner {
  bannerId: number;
  title: string;
  subtitle: string | null;
  /** 좌상단 라벨 (EVENT / NEW 등) */
  label: string | null;
  /** 이미지 배너면 올린 그림, 공연 배너면 그 공연 포스터. 없으면 null */
  imageUrl: string | null;
  /** 누르면 갈 서비스 내 경로. 없으면 이동하지 않습니다 */
  linkPath: string | null;
  /** 공연 배너일 때만. 화면이 공연 상세 경로를 만듭니다 */
  performanceId: number | null;
}
