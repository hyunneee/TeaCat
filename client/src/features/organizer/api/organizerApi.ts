import { http } from '@/shared/api';
import type { ConcertDetail, ConcertSummary } from '@/features/concert';
import {
  toConcertCreateFormData,
  type ConcertArea,
  type ConcertAreaSetting,
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

  /**
   * 전체 공연 목록 — 등록자와 무관하게, 비공개 포함.
   *
   * 🔴 **ADMIN 전용입니다** (서버가 경로로 막습니다). 공연 주최자(PERFORMANCE)가 부르면 403 이니
   *    그쪽에는 `myConcerts` 를 쓰세요. 어느 쪽을 부를지는 `useManagedConcerts` 가 판단합니다.
   */
  allConcerts: (keyword?: string) =>
    http.get<ConcertSummary[]>('/admin/concerts', {
      // 빈 문자열을 보내면 서버가 "빈 검색어" 로 받습니다. axios 는 undefined 를 뺍니다
      params: { keyword: keyword?.trim() || undefined },
    }),

  /** 구역 등급·가격 편집 화면이 읽는 값 — 아직 팔지 않는 구역까지 전부 옵니다 */
  concertAreas: (concertId: string) =>
    http.get<ConcertArea[]>(`/admin/concerts/${concertId}/areas`),

  /** 구역 등급·가격 저장 (API-268). PUT 이라 보낸 것이 전체가 됩니다 */
  saveConcertAreas: (concertId: string, areas: ConcertAreaSetting[]) =>
    http.put<unknown>(`/admin/concerts/${concertId}/areas`, { areas }),

  /** 내가 등록한 공연 상세 — 비공개여도 옵니다. 수정 화면이 씁니다 */
  myConcert: (concertId: string) => http.get<ConcertDetail>(`/admin/concerts/${concertId}`),

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

/**
 * 🔴 전부 `all` 아래에 둡니다. 수정·삭제·노출 전환 훅이 `organizerKeys.all` 하나로 무효화하는데,
 *    바깥에 새 키를 만들면 그 목록만 옛 값으로 남습니다.
 */
export const organizerKeys = {
  all: ['organizer'] as const,
  stadiums: () => [...organizerKeys.all, 'stadiums'] as const,
  myConcerts: () => [...organizerKeys.all, 'myConcerts'] as const,
  myConcert: (concertId: string) => [...organizerKeys.all, 'myConcert', concertId] as const,
  allConcerts: (keyword: string) => [...organizerKeys.all, 'allConcerts', keyword] as const,
  concertAreas: (concertId: string) => [...organizerKeys.all, 'areas', concertId] as const,
};
