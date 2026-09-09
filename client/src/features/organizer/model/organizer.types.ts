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

/**
 * 공연장의 무대 형식(배치).
 *
 * 한 공연장이 무대를 U형·O형처럼 바꿀 수 있고, 형식마다 구역이 다르게 나뉩니다.
 * 형식과 그 구역·좌석은 공연장 관리에서 미리 저장해 두고, 공연은 그중 하나를 골라 씁니다.
 */
export interface StadiumLayoutSummary {
  layoutId: number;
  name: string;
  /** 공연장이 이 형식을 기본으로 씁니다. 형식을 안 고르면 서버가 이걸 씁니다 */
  isDefault: boolean;
  /** `ACTIVE` 만 공연에 쓸 수 있습니다. `DRAFT`·`ARCHIVED` 는 서버가 거절합니다 (PERFORMANCE_LAYOUT_005) */
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  areaCount: number;
  seatCount: number;
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
/**
 * 회차 좌석 생성 결과.
 *
 * 스탠딩으로만 파는 공연은 만들 좌석이 없어 `createdSeatCount` 가 0 으로 옵니다 —
 * 실패가 아니라 "만들 게 없었다" 는 뜻입니다.
 */
export interface SeatGenerateResponse {
  scheduleId: number;
  createdSeatCount: number;
  /** 좌석을 만든 구역 수. 스탠딩 구역은 빠집니다 */
  seatedAreaCount: number;
}

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
  /**
   * 무대 형식(배치) `<select>` 값. 공연장을 고르면 그 공연장의 형식 목록에서 고릅니다.
   * 이 형식의 구역만 이 공연에서 팔 수 있습니다. 등록에서만 씁니다 —
   * 수정에서 형식을 바꾸면 저장해 둔 구역 설정과 생성한 좌석이 전부 어긋납니다.
   */
  stadiumLayoutId: string;
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
  stadiumLayoutId: '',
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

/* ── 포토카드 도안 ─────────────────────────────────────────── */

/**
 * 공연과 함께 등록할 포토카드 도안 한 줄 (`POST /admin/photocard-designs`, multipart).
 *
 * **공연이 만들어진 뒤에야 보낼 수 있습니다** — 도안이 `performanceId` 를 필수로 받기 때문입니다.
 * 그래서 폼에서는 모아만 두고, 공연 등록이 성공한 직후 순서대로 보냅니다.
 *
 * `totalSupply` 는 온체인 `maxSupply` 가 됩니다. **첫 장이 발급되는 순간 동결되어 아무도 바꿀 수
 * 없습니다** — "한정 100장" 이 약관이 아니라 컨트랙트가 지키는 약속이 되는 자리입니다.
 * (blockchain/PHOTOCARD_PLAN.md 3장)
 */
export interface PhotocardDesignForm {
  name: string;
  /** `<input type="number">` 값이라 문자열입니다. 비어 있으면 미입력 */
  totalSupply: string;
  /** 메타데이터 JSON 에만 들어가고 DB 에는 저장되지 않습니다 */
  description: string;
  image: File | null;
}

/** 도안 등록 응답 중 화면이 쓰는 부분 */
export interface PhotocardDesignResponse {
  designId: number;
  name: string;
  imageUrl: string;
  totalSupply: number;
  /** PENDING · REGISTERING · REGISTERED · FAILED */
  chainStatus: string;
}

export const EMPTY_PHOTOCARD_DESIGN: PhotocardDesignForm = {
  name: '',
  totalSupply: '',
  description: '',
  image: null,
};

/** 서버 `ipfs.pinata.image-max-size` 와 같은 값입니다 */
export const DESIGN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const DESIGN_NAME_MAX_LENGTH = 100;
export const DESIGN_DESCRIPTION_MAX_LENGTH = 500;
/** 서버 검증(@Max)과 같은 값 */
export const DESIGN_MAX_SUPPLY = 100_000;

export type PhotocardDesignErrors = Partial<Record<keyof PhotocardDesignForm, string>>;

/**
 * 도안 한 줄 검증. 서버가 같은 규칙으로 다시 검사합니다
 * (이름 100자·수량 1~100,000: NftPhotocardDesignCreateRequest, 이미지: STORAGE_002·003).
 *
 * <b>완전히 빈 줄은 검사하지 않습니다.</b> "도안 없이 공연만 등록" 이 정상 경로라,
 * 아무것도 안 채운 줄은 보내지 않고 버립니다.
 */
export function validatePhotocardDesign(design: PhotocardDesignForm): PhotocardDesignErrors {
  const errors: PhotocardDesignErrors = {};
  if (isEmptyPhotocardDesign(design)) return errors;

  if (!design.name.trim()) errors.name = '도안 이름을 입력해 주세요.';
  else if (design.name.length > DESIGN_NAME_MAX_LENGTH) {
    errors.name = `이름은 ${DESIGN_NAME_MAX_LENGTH}자 이하여야 해요.`;
  }

  const supply = Number(design.totalSupply);
  if (!design.totalSupply) errors.totalSupply = '한정 수량을 입력해 주세요.';
  else if (!Number.isInteger(supply) || supply < 1) errors.totalSupply = '1 이상의 정수여야 해요.';
  else if (supply > DESIGN_MAX_SUPPLY) {
    errors.totalSupply = `${DESIGN_MAX_SUPPLY.toLocaleString()}장 이하여야 해요.`;
  }

  if (design.description.length > DESIGN_DESCRIPTION_MAX_LENGTH) {
    errors.description = `설명은 ${DESIGN_DESCRIPTION_MAX_LENGTH}자 이하여야 해요.`;
  }

  if (!design.image) errors.image = '도안 이미지를 골라 주세요.';
  else {
    const image = imageError(design.image, DESIGN_IMAGE_MAX_BYTES);
    if (image) errors.image = image;
  }

  return errors;
}

/** 사용자가 아무것도 손대지 않은 줄. 보내지 않고 버립니다 */
export function isEmptyPhotocardDesign(design: PhotocardDesignForm): boolean {
  return !design.name.trim() && !design.totalSupply && !design.description.trim() && !design.image;
}

/** 실제로 보낼 줄만 남깁니다 */
export function filledPhotocardDesigns(designs: PhotocardDesignForm[]): PhotocardDesignForm[] {
  return designs.filter((design) => !isEmptyPhotocardDesign(design));
}

export function arePhotocardDesignsValid(designs: PhotocardDesignForm[]): boolean {
  return designs.every((design) => Object.keys(validatePhotocardDesign(design)).length === 0);
}

/** 도안 등록 multipart 바디 */
export function toPhotocardDesignFormData(
  performanceId: number,
  design: PhotocardDesignForm,
): FormData {
  const body = new FormData();
  body.append('performanceId', String(performanceId));
  body.append('name', design.name.trim());
  body.append('totalSupply', design.totalSupply);
  if (design.description.trim()) body.append('description', design.description.trim());
  if (design.image) body.append('image', design.image);
  return body;
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

  /* 형식은 등록에서만 고릅니다. 공연장을 골랐으면 형식도 골라야 구역이 정해집니다 */
  if (mode === 'create' && form.stadiumId && !form.stadiumLayoutId) {
    errors.stadiumLayoutId = '무대 형식을 선택해 주세요.';
  }

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
  /* 비우면 서버가 공연장의 기본 배치를 씁니다. 빈 문자열을 보내면 Long 변환이 실패해 400 이라 아예 뺍니다 */
  if (form.stadiumLayoutId) body.append('stadiumLayoutId', form.stadiumLayoutId);
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
    /* 수정 폼은 형식을 바꾸지 않지만, 구역 목록을 이 형식 기준으로 불러와야 합니다 */
    stadiumLayoutId: String(concert.layout.layoutId),
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
