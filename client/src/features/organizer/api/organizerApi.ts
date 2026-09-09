import { http } from '@/shared/api';
import type { ConcertDetail, ConcertSummary, PerformanceArea } from '@/features/concert';
import type { AreaSaveRequest, StadiumAreaListResponse } from '../model/areaPricing';
import {
  toConcertCreateFormData,
  toPhotocardDesignFormData,
  toServerDateTime,
  type ConcertCreateForm,
  type ConcertCreateResponse,
  type ConcertUpdateRequest,
  type ConcertVisibilityResponse,
  type ImageType,
  type PhotocardDesignForm,
  type PhotocardDesignResponse,
  type PresignedUpload,
  type ScheduleCreateResponse,
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
  createConcert: (form: ConcertCreateForm) =>
    http.post<ConcertCreateResponse>('/admin/concerts', toConcertCreateFormData(form), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

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
   * 포토카드 도안 등록. ADMIN 전용, multipart.
   *
   * 요청 하나가 **IPFS 핀 두 번(이미지 → 메타데이터 JSON) → 도안 저장 → 온체인 등록**까지 갑니다.
   * 그래서 공연 등록보다 느리고, 응답은 `chainStatus: REGISTERING` 으로 옵니다 —
   * 확정(`REGISTERED`)은 서버의 감시가 30~40초 뒤에 채웁니다.
   *
   * 공연 이미지와 달리 업로드 URL(API-270)을 쓰지 않습니다. 파일 바이트를 쥔 쪽이 그대로
   * Pinata 에 올려야 CID 가 나오기 때문입니다.
   */
  createPhotocardDesign: (performanceId: number, design: PhotocardDesignForm) =>
    http.post<PhotocardDesignResponse>(
      '/admin/photocard-designs',
      toPhotocardDesignFormData(performanceId, design),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),

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
};

export const organizerKeys = {
  all: ['organizer'] as const,
  stadiums: () => [...organizerKeys.all, 'stadiums'] as const,
  myConcerts: () => [...organizerKeys.all, 'myConcerts'] as const,
  myConcert: (concertId: string) => [...organizerKeys.all, 'myConcert', concertId] as const,
  stadiumLayouts: (stadiumId: string) => [...organizerKeys.all, 'stadiumLayouts', stadiumId] as const,
  /* 구역은 공연장이 아니라 **무대 형식**에 딸려 있습니다. 형식마다 구역이 다르게 나뉘어서,
     공연장 id 로 캐시하면 형식을 바꿔도 앞 형식의 구역이 그대로 남습니다 */
  layoutAreas: (layoutId: string) => [...organizerKeys.all, 'layoutAreas', layoutId] as const,
};
