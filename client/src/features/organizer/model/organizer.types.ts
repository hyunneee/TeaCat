import type { ConcertDetail } from '@/features/concert';

/**
 * 공연 관리(주최자·관리자) 모델.
 *
 * 서버 명세: `POST /admin/concerts` (API-261, multipart), `PATCH /admin/concerts/{id}` (API-262),
 * `DELETE /admin/concerts/{id}` (API-263), `POST /admin/uploads/presigned` (API-270), `GET /stadiums` (API-251).
 */

/** 공연장 목록 항목 (API-251) */
export interface StadiumSummary {
  stadiumId: number;
  name: string;
  address: string;
  phone: string | null;
}

/** 공연 등록 응답 (API-261) */
export interface ConcertCreateResponse {
  concertId: number;
}

/** 이미지 업로드 URL 발급 응답 (API-270) */
export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  expiresInSeconds: number;
  maxFileSizeBytes: number;
}

export type ImageType = 'POSTER' | 'DETAIL';

/** 회차 등록 응답 (API-265) */
export interface ScheduleCreateResponse {
  scheduleId: number;
  performanceNum: number;
}

/** 공연 노출 전환 응답 (API-271) */
export interface ConcertVisibilityResponse {
  concertId: number;
  visible: boolean;
  /** 비공개로 바뀐 시각. 공개 상태면 null */
  hiddenAt: string | null;
}

/**
 * 공연 수정 요청 (API-262). 보내는 필드만 바뀝니다.
 * 이미지는 파일이 아니라 업로드 URL 로 올린 뒤 받은 key 를 넘깁니다.
 */
export interface ConcertUpdateRequest {
  title?: string;
  stadiumId?: number;
  ticketingStartAt?: string;
  visibleFrom?: string;
  posterImageKey?: string;
  detailImageKey?: string;
}

/** 공연 등록·수정 폼. 입력 요소의 값이라 전부 문자열이고, 파일만 File 입니다 */
export interface ConcertCreateForm {
  title: string;
  /** `<select>` 값. 비어 있으면 미선택 */
  stadiumId: string;
  /** `datetime-local` 값 — `2026-10-01T20:00` */
  ticketingStartAt: string;
  /** `date` 값 — `2026-09-20` */
  visibleFrom: string;
  /** 새로 올릴 파일. 수정에서 null 이면 "그대로 둔다" 입니다 */
  poster: File | null;
  detailImage: File | null;
  /**
   * 함께 등록할 회차의 공연 일시 (`datetime-local` 값). 등록에서만 쓰고, 서버가 일시 순으로 번호를 붙입니다.
   * 수정에서는 비어 있습니다 — 회차 편집은 회차 API(265~267) 의 일이라 이 폼이 다루지 않습니다.
   */
  performanceDates: string[];
}

export type ConcertCreateErrors = Partial<Record<keyof ConcertCreateForm, string>> & {
  /** 회차 줄마다의 에러. 인덱스는 `performanceDates` 와 같습니다 */
  performanceDateItems?: (string | undefined)[];
};

export const EMPTY_CONCERT_CREATE: ConcertCreateForm = {
  title: '',
  stadiumId: '',
  ticketingStartAt: '',
  visibleFrom: '',
  poster: null,
  detailImage: null,
  // 회차 한 줄을 미리 열어둡니다. 회차 없는 공연은 예매할 게 없어서, 빈 목록으로 시작하면 빠뜨리기 쉽습니다
  performanceDates: [''],
};

/**
 * 이미지 제한. 서버 설정(`performance.image.*`)과 같은 값입니다 —
 * 올리기 전에 걸러 주기 위한 것이고, 진짜 검사는 서버가 합니다(STORAGE_002·003, PERFORMANCE_019).
 */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const POSTER_MAX_BYTES = 5 * 1024 * 1024;
export const DETAIL_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

export const TITLE_MAX_LENGTH = 200;

function imageError(file: File | null, maxBytes: number): string | undefined {
  if (!file) return undefined;
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'jpg, png, webp, gif 파일만 올릴 수 있어요.';
  }
  if (file.size > maxBytes) {
    return `${Math.floor(maxBytes / 1024 / 1024)}MB 이하 파일만 올릴 수 있어요.`;
  }
  return undefined;
}

export type ConcertFormMode = 'create' | 'edit';

/**
 * 서버 규칙을 미리 검사합니다 — 서버는 같은 규칙으로 다시 검사합니다.
 * (제목 200자, 노출 시작일은 티켓팅 시작일보다 앞서야 함: PERFORMANCE_004,
 *  회차 일시는 티켓팅 시작 이후·중복 불가: PERFORMANCE_008·021)
 *
 * 회차는 **등록에서만** 검사합니다. 수정 폼은 회차를 다루지 않습니다.
 */
export function validateConcertCreate(
  form: ConcertCreateForm,
  mode: ConcertFormMode = 'create',
): ConcertCreateErrors {
  const errors: ConcertCreateErrors = {};

  if (mode === 'create') {
    const items = form.performanceDates.map((date, i, all) => {
      if (!date) return '공연 일시를 입력해 주세요.';
      if (form.ticketingStartAt && date < form.ticketingStartAt) return '티켓팅 오픈 이후여야 해요.';
      if (all.indexOf(date) !== i) return '같은 일시의 회차가 있어요.';
      return undefined;
    });

    if (form.performanceDates.length === 0) {
      errors.performanceDates = '회차를 하나 이상 등록해 주세요.';
    } else if (items.some(Boolean)) {
      errors.performanceDates = '회차 일시를 확인해 주세요.';
      errors.performanceDateItems = items;
    }
  }

  if (!form.title.trim()) errors.title = '공연 제목을 입력해 주세요.';
  else if (form.title.length > TITLE_MAX_LENGTH) errors.title = `제목은 ${TITLE_MAX_LENGTH}자 이하여야 해요.`;

  if (!form.stadiumId) errors.stadiumId = '공연장을 선택해 주세요.';

  if (!form.ticketingStartAt) errors.ticketingStartAt = '티켓팅 오픈 시각을 입력해 주세요.';

  if (!form.visibleFrom) {
    errors.visibleFrom = '노출 시작일을 입력해 주세요.';
  } else if (form.ticketingStartAt && form.visibleFrom > form.ticketingStartAt.slice(0, 10)) {
    errors.visibleFrom = '노출 시작일은 티켓팅 오픈일보다 늦을 수 없어요.';
  }

  const poster = imageError(form.poster, POSTER_MAX_BYTES);
  if (poster) errors.poster = poster;

  const detail = imageError(form.detailImage, DETAIL_IMAGE_MAX_BYTES);
  if (detail) errors.detailImage = detail;

  return errors;
}

export function isConcertCreateValid(form: ConcertCreateForm, mode: ConcertFormMode = 'create'): boolean {
  return Object.keys(validateConcertCreate(form, mode)).length === 0;
}

/** 서버 `LocalDateTime`(초까지) → `datetime-local` 값(분까지) */
function toDateTimeLocal(iso: string): string {
  return iso.slice(0, 16);
}

/** `datetime-local` 값(분까지) → 서버 `LocalDateTime`(초까지) */
export function toServerDateTime(local: string): string {
  return local.length === 16 ? `${local}:00` : local;
}

/**
 * 수정 화면에서 회차를 하나 추가할 때의 검사 (API-265 규칙).
 * 티켓팅 시작 이전은 서버가 PERFORMANCE_008 로 거절하고, 같은 일시 중복은 서버 규칙엔 없지만 실수라서 막습니다.
 *
 * @param existing 이미 등록된 회차의 공연 일시(서버 형식)
 */
export function validateNewScheduleDate(
  date: string,
  concert: Pick<ConcertDetail, 'ticketingStartAt'>,
  existing: string[],
): string | undefined {
  if (!date) return '공연 일시를 입력해 주세요.';
  if (date < toDateTimeLocal(concert.ticketingStartAt)) return '티켓팅 오픈 이후여야 해요.';
  if (existing.some((iso) => toDateTimeLocal(iso) === date)) return '같은 일시의 회차가 이미 있어요.';
  return undefined;
}

/**
 * multipart 본문으로 바꿉니다 (등록, API-261).
 */
export function toConcertCreateFormData(form: ConcertCreateForm): FormData {
  const body = new FormData();
  body.append('title', form.title.trim());
  body.append('stadiumId', form.stadiumId);
  body.append('ticketingStartAt', toServerDateTime(form.ticketingStartAt));
  body.append('visibleFrom', form.visibleFrom);
  if (form.poster) body.append('poster', form.poster);
  if (form.detailImage) body.append('detailImage', form.detailImage);
  // 같은 키를 반복하면 서버가 List 로 받습니다
  for (const date of form.performanceDates) {
    body.append('performanceDates', toServerDateTime(date));
  }
  return body;
}

/** 수정 폼의 초깃값 — 공연 상세 응답에서 채웁니다 */
export function concertToForm(concert: ConcertDetail): ConcertCreateForm {
  return {
    title: concert.title,
    stadiumId: String(concert.stadium.stadiumId),
    ticketingStartAt: toDateTimeLocal(concert.ticketingStartAt),
    visibleFrom: concert.visibleFrom,
    poster: null,
    detailImage: null,
    performanceDates: [],
  };
}

/**
 * 티켓팅이 시작됐는가 (API-262 의 잠금 규칙).
 * 시작 뒤에는 제목·이미지만 바꿀 수 있고, 공연장·티켓팅 시각·노출 시작일은 서버가 거절합니다(PERFORMANCE_003).
 */
export function isTicketingStarted(concert: Pick<ConcertDetail, 'ticketingStartAt'>, now = new Date()): boolean {
  return new Date(concert.ticketingStartAt).getTime() <= now.getTime();
}

/** 수정 폼에 저장하지 않은 변경이 있는가 (나가기 방지·저장 확인의 기준) */
export function isConcertFormDirty(form: ConcertCreateForm, original: ConcertDetail): boolean {
  return (
    Object.keys(toConcertUpdateRequest(form, original)).length > 0 ||
    form.poster !== null ||
    form.detailImage !== null
  );
}

/**
 * 수정 요청 본문 — **바뀐 필드만** 담습니다. 이미지 key 는 호출부가 업로드를 끝낸 뒤 덧붙입니다.
 * 바뀐 게 없으면 빈 객체라, 서버의 "변경할 내용이 없습니다"(PERFORMANCE_005) 대신 여기서 막을 수 있습니다.
 */
export function toConcertUpdateRequest(
  form: ConcertCreateForm,
  original: ConcertDetail,
): ConcertUpdateRequest {
  const base = concertToForm(original);
  const body: ConcertUpdateRequest = {};

  if (form.title.trim() !== base.title) body.title = form.title.trim();
  if (form.stadiumId !== base.stadiumId) body.stadiumId = Number(form.stadiumId);
  if (form.ticketingStartAt !== base.ticketingStartAt) {
    body.ticketingStartAt = toServerDateTime(form.ticketingStartAt);
  }
  if (form.visibleFrom !== base.visibleFrom) body.visibleFrom = form.visibleFrom;

  return body;
}
