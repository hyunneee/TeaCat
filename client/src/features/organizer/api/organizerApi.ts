import { http } from '@/shared/api';
import { downscaleImage } from '@/shared/lib';
import type { ConcertDetail, ConcertSummary, PerformanceArea } from '@/features/concert';
import type { AreaSaveRequest, StadiumAreaListResponse } from '../model/areaPricing';
import {
  toConcertCreateFormData,
  toServerDateTime,
  type ConcertCreateForm,
  type ConcertCreateResponse,
  type ConcertUpdateRequest,
  type ConcertVisibilityResponse,
  type ImageType,
  type PresignedUpload,
  type ScheduleCreateResponse,
  type SeatGenerateResponse,
  type StadiumLayoutSummary,
  type StadiumSummary,
} from '../model/organizer.types';

export const organizerApi = {
  /** 공연장 목록 (API-251) — 등록 폼의 공연장 선택용 */
  listStadiums: async () => {
    const response = await http.get<{ stadiums: StadiumSummary[] }>('/stadiums');
    return response.stadiums;
  },

  /**
   * 공연 등록 (API-261). ADMIN 전용.
   *
   * 공용 axios 인스턴스의 기본 Content-Type 이 `application/json` 인데, axios 는 그 상태로
   * FormData 를 받으면 **JSON 으로 바꿔 보냅니다**(파일이 날아가고 서버는 415). 그래서
   * multipart 를 명시합니다 — boundary 는 브라우저가 붙입니다.
   */
  createConcert: async (form: ConcertCreateForm) =>
    /* 등록은 파일을 multipart 로 서버에 보내고(수정은 스토리지로 직접 PUT 합니다),
       서버는 크기만 검사하고 변환하지 않습니다. 그래서 여기서도 줄여 보냅니다 —
       한쪽만 줄이면 "등록한 공연은 가볍고 수정한 공연은 무거운" 상태가 됩니다. */
    http.post<ConcertCreateResponse>(
      '/admin/concerts',
      toConcertCreateFormData(await shrink(form)),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    ),

  /** 공연 수정 (API-262). 보낸 필드만 바뀝니다 */
  updateConcert: (concertId: string, body: ConcertUpdateRequest) =>
    http.patch<void>(`/admin/concerts/${concertId}`, body),

  /** 공연 삭제 (API-263). 예매 이력이 있으면 서버가 거절합니다(PERFORMANCE_017) */
  deleteConcert: (concertId: string) => http.delete<void>(`/admin/concerts/${concertId}`),

  /** 공연 노출 전환 (API-271). 비공개는 목록·상세에서 감출 뿐 데이터를 지우지 않아 되돌릴 수 있습니다 */
  setVisibility: (concertId: string, visible: boolean) =>
    http.patch<ConcertVisibilityResponse>(`/admin/concerts/${concertId}/visibility`, { visible }),

  /** 내가 등록한 공연 목록 — 비공개 포함. 비공개 공연을 되돌릴 입구입니다 */
  myConcerts: () => http.get<ConcertSummary[]>('/admin/concerts/mine'),

  /** 내가 등록한 공연 상세 — 비공개여도 옵니다. 수정 화면이 씁니다 */
  myConcert: (concertId: string) => http.get<ConcertDetail>(`/admin/concerts/${concertId}`),

  /** 공연장의 무대 형식(배치) 목록. 공연을 등록할 때 어느 형식으로 팔지 고릅니다 */
  listStadiumLayouts: async (stadiumId: string) => {
    const response = await http.get<{ stadiumId: number; layouts: StadiumLayoutSummary[] }>(
      `/stadiums/${stadiumId}/layouts`,
    );
    return response.layouts;
  },

  /**
   * 무대 형식별 구역 목록. 구역별 등급·가격을 정할 때 줄을 만드는 바탕입니다.
   *
   * ⚠️ 공연장 기준(`/stadiums/{id}/areas`)이 아니라 **형식 기준**으로 부릅니다.
   * 공연장 기준은 기본 배치의 구역만 주므로, 기본이 아닌 형식으로 등록한 공연에서는
   * 다른 형식의 구역이 떠서 저장이 거절됩니다 (PERFORMANCE_010).
   */
  listLayoutAreas: async (layoutId: string) => {
    const response = await http.get<StadiumAreaListResponse>(`/stadium-layouts/${layoutId}/areas`);
    return response.areas;
  },

  /** 공연 구역 등급·가격 일괄 저장 (API-268). PUT 이라 보낸 목록이 전체가 됩니다 */
  saveAreas: (concertId: string, body: AreaSaveRequest) =>
    http.put<PerformanceArea[]>(`/admin/concerts/${concertId}/areas`, body),

  /**
   * 회차 등록 (API-265). 번호를 넘기지 않으면 서버가 그 공연의 회차 번호를 **일시 순으로 다시 매깁니다**.
   * 그래서 더 이른 날짜를 나중에 추가해도 1회차가 가장 빠른 공연입니다. 삭제(267) 뒤에도 같은 규칙으로 다시 매겨집니다.
   */
  createSchedule: (concertId: string, performanceDate: string) =>
    http.post<ScheduleCreateResponse>(`/admin/concerts/${concertId}/schedules`, {
      performanceDate: toServerDateTime(performanceDate),
    }),

  /** 회차 삭제 (API-267). 예매 이력이 있으면 서버가 거절합니다(PERFORMANCE_009) */
  deleteSchedule: (scheduleId: string) => http.delete<void>(`/admin/schedules/${scheduleId}`),

  /**
   * 회차 좌석 생성.
   *
   * 🔴 **이걸 돌리지 않으면 예매가 열리지 않습니다.** 회차를 만들어도 좌석 행은 생기지 않고,
   *    좌석맵은 전 좌석을 `BLOCKED` 로 내려줍니다 — 예매 화면에서는 "매진" 처럼 보입니다.
   *    구역 등급·가격을 먼저 저장한 뒤에 눌러야 합니다 (판매하기로 한 구역의 좌석만 만듭니다).
   *
   * 🔴 **다시 돌릴 수 없습니다.** 좌석 행이 하나라도 있으면 서버가 거절합니다
   *    (PERFORMANCE_014 이미 좌석이 생성된 회차입니다). 구역을 나중에 추가했다면 지금은 회차를 지웠다
   *    다시 만드는 수밖에 없습니다.
   */
  generateSeats: (scheduleId: string) =>
    http.post<SeatGenerateResponse>(`/admin/schedules/${scheduleId}/seats`),

  /** 이미지 업로드 URL 발급 (API-270) */
  issueUploadUrl: (imageType: ImageType, contentType: string) =>
    http.post<PresignedUpload>('/admin/uploads/presigned', { imageType, contentType }),

  /**
   * 발급받은 URL 로 파일을 MinIO 에 직접 올립니다 (서버를 거치지 않음).
   *
   * 공용 axios 인스턴스를 쓰지 않는 이유: 인터셉터가 `Authorization` 헤더를 붙이는데,
   * presigned URL 은 서명이 URL 안에 있어 인증 헤더가 하나 더 붙으면 스토리지가 거절합니다.
   * 응답 봉투도 없는 외부 주소라 `fetch` 가 맞습니다.
   */
  uploadToStorage: async (upload: PresignedUpload, file: File): Promise<string> => {
    const res = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) throw new Error('이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.');
    return upload.key;
  },

  /**
   * 줄여서 올리고 저장 키를 돌려줍니다. **이미지 업로드는 이걸 쓰세요.**
   *
   * 🔴 순서가 중요합니다 — 발급받은 URL 은 **콘텐츠 타입에 묶여** 있어서, 먼저 줄여
   *    WebP 로 바꾼 뒤에 URL 을 받아야 합니다. 반대로 하면 스토리지가 PUT 을 거절합니다.
   *
   * 원본을 그대로 올리면 그대로 서빙됩니다 — 서버는 크기만 검사하고 변환하지 않고,
   * 업로드도 서버를 거치지 않습니다. 줄일 수 있는 지점이 여기뿐입니다.
   */
  uploadImage: async (imageType: ImageType, file: File): Promise<string> => {
    const shrunk = await downscaleImage(file, { maxWidth: MAX_IMAGE_WIDTH[imageType] });
    const upload = await organizerApi.issueUploadUrl(imageType, shrunk.type);
    return organizerApi.uploadToStorage(upload, shrunk);
  },
};

/**
 * 올릴 때 줄일 긴 변의 한도(px).
 *
 * 화면에서 실제로 쓰이는 크기 + 고해상도 화면(3배)을 감당할 만큼만 둡니다.
 * 포스터는 가장 크게 보이는 곳이 라이트박스(폭 768px)이고, 상세 이미지는 본문 폭
 * 768px 에 세로로 긴 한 장입니다.
 */
const MAX_IMAGE_WIDTH: Record<ImageType, number> = {
  POSTER: 1000,
  DETAIL: 1440,
};

/** 등록 폼에 담긴 포스터·상세 이미지를 줄인 사본으로 바꿔 돌려줍니다 */
async function shrink(form: ConcertCreateForm): Promise<ConcertCreateForm> {
  const [poster, detailImage] = await Promise.all([
    form.poster ? downscaleImage(form.poster, { maxWidth: MAX_IMAGE_WIDTH.POSTER }) : form.poster,
    form.detailImage
      ? downscaleImage(form.detailImage, { maxWidth: MAX_IMAGE_WIDTH.DETAIL })
      : form.detailImage,
  ]);

  return { ...form, poster, detailImage };
}

export const organizerKeys = {
  all: ['organizer'] as const,
  stadiums: () => [...organizerKeys.all, 'stadiums'] as const,
  myConcerts: () => [...organizerKeys.all, 'myConcerts'] as const,
  myConcert: (concertId: string) => [...organizerKeys.all, 'myConcert', concertId] as const,
  stadiumLayouts: (stadiumId: string) =>
    [...organizerKeys.all, 'stadiumLayouts', stadiumId] as const,
  /* 구역은 공연장이 아니라 **무대 형식**에 딸려 있습니다. 형식마다 구역이 다르게 나뉘어서,
     공연장 id 로 캐시하면 형식을 바꿔도 앞 형식의 구역이 그대로 남습니다 */
  layoutAreas: (layoutId: string) => [...organizerKeys.all, 'layoutAreas', layoutId] as const,
};
