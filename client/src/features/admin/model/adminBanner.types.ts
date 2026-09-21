/** 이미지를 직접 올리거나(IMAGE), 공연을 지정합니다(PERFORMANCE) */
export type AdminBannerType = 'IMAGE' | 'PERFORMANCE';

/** 서버 `AdminBannerResponse`. 노출을 끈 것까지 전부 옵니다 */
export interface AdminBanner {
  bannerId: number;
  type: AdminBannerType;
  title: string;
  subtitle: string | null;
  label: string | null;
  /** 미리보기용. 공연 배너면 그 공연 포스터입니다 */
  imageUrl: string | null;
  imageKey: string | null;
  /** 틀에 안 맞는 그림에서 어디를 남길지 (%). 타입과 무관하게 옵니다 */
  imageFocusX: number;
  imageFocusY: number;
  performanceId: number | null;
  performanceTitle: string | null;
  linkPath: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}

/** 등록·수정 요청. 타입에 따라 채우는 칸이 다릅니다 */
export interface AdminBannerWriteRequest {
  type: AdminBannerType;
  title: string;
  subtitle: string | null;
  label: string | null;
  /** IMAGE 일 때 필수 */
  imageKey: string | null;
  /** 그림에서 보여줄 한 점 (%). **타입과 무관합니다** — 공연 포스터도 같은 틀에 담깁니다 */
  imageFocusX: number;
  imageFocusY: number;
  /** PERFORMANCE 일 때 필수 */
  performanceId: number | null;
  /** IMAGE 일 때만. 비우면 눌러도 이동하지 않습니다 */
  linkPath: string | null;
  active: boolean;
}

export interface BannerUploadUrl {
  uploadUrl: string;
  key: string;
  expiresInSeconds: number;
  maxFileSizeBytes: number;
}
