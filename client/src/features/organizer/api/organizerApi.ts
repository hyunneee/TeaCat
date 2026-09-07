import { http } from '@/shared/api';
import {
  toConcertCreateFormData,
  toServerDateTime,
  type ConcertCreateForm,
  type ConcertCreateResponse,
  type ConcertUpdateRequest,
  type ImageType,
  type PresignedUpload,
  type ScheduleCreateResponse,
  type StadiumSummary,
} from '../model/organizer.types';

export const organizerApi = {
  /** 공연장 목록 (API-251) — 등록 폼의 공연장 선택용 */
  listStadiums: () => http.get<StadiumSummary[]>('/stadiums'),

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
};
