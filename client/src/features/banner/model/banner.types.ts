/**
 * 메인 슬라이드(배너).
 *
 * 서버 `GET /banners` 응답 그대로입니다. 노출 중인 것만, 순서대로 옵니다.
 *
 * 링크는 **완성된 주소가 아닙니다.** 공연 배너는 `performanceId` 만 오고 화면이
 * `ROUTES.CONCERT_DETAIL(id)` 로 조립합니다 — 경로 규칙은 프론트가 가진 것이라
 * 서버가 문자열로 박으면 경로를 바꿀 때 서버까지 고쳐야 합니다. (CLAUDE.md 3-5)
 */
/**
 * 그림에서 **보여줄 부분**. 서버 `main_banner_image_focus` 와 1:1 입니다.
 *
 * 배너 틀은 폰 4:3, 데스크톱 2:1 이라 비율이 다른 그림은 반드시 잘립니다.
 * 무엇을 남길지는 그림마다 달라서 관리자가 고르고, 화면은 `objectPositionOf` 로
 * CSS `object-position` 에 옮깁니다 (`model/bannerFocus.ts`).
 */
export type BannerImageFocus =
  | 'TOP_LEFT'
  | 'TOP'
  | 'TOP_RIGHT'
  | 'LEFT'
  | 'CENTER'
  | 'RIGHT'
  | 'BOTTOM_LEFT'
  | 'BOTTOM'
  | 'BOTTOM_RIGHT';

export interface Banner {
  bannerId: number;
  title: string;
  subtitle: string | null;
  /** 좌상단 라벨 (EVENT / NEW 등) */
  label: string | null;
  /** 이미지 배너면 올린 그림, 공연 배너면 그 공연 포스터. 없으면 null */
  imageUrl: string | null;
  /** 틀에 안 맞는 그림에서 어디를 남길지. 지정하지 않았으면 가운데입니다 */
  imageFocus: BannerImageFocus;
  /** 누르면 갈 서비스 내 경로. 없으면 이동하지 않습니다 */
  linkPath: string | null;
  /** 공연 배너일 때만. 화면이 공연 상세 경로를 만듭니다 */
  performanceId: number | null;
}
