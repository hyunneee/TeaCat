import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { env } from '@/shared/config';
import { ApiError, ERROR_CODE } from './ApiError';
import { getAuthBridge } from './authBridge';
import type { ApiEnvelope, ApiErrorBody } from '@/shared/types';

/** 요청 단위 커스텀 옵션 */
export interface RequestOptions extends AxiosRequestConfig {
  /**
   * 같은 요청이 두 번 도달해도 서버가 한 번만 처리하도록 하는 키.
   * 결제/예매처럼 "중복 실행되면 안 되는" POST 에 반드시 붙입니다.
   * (더블클릭, 네트워크 재시도, 뒤로가기 후 재제출 방어)
   */
  idempotencyKey?: string;
  /** 401 이어도 토큰 리프레시를 시도하지 않음 (로그인/리프레시 요청 자체) */
  skipAuthRefresh?: boolean;
}

type Cfg = InternalAxiosRequestConfig & RequestOptions & { _retried?: boolean };

const instance: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  withCredentials: true, // 리프레시 토큰을 httpOnly 쿠키로 받는 경우
  headers: { 'Content-Type': 'application/json' },
});

/* ── 요청 인터셉터 ───────────────────────────────────────── */
instance.interceptors.request.use((config) => {
  const cfg = config as Cfg;

  const token = getAuthBridge().getAccessToken();
  if (token) cfg.headers.set('Authorization', `Bearer ${token}`);

  if (cfg.idempotencyKey) cfg.headers.set('Idempotency-Key', cfg.idempotencyKey);

  return cfg;
});

/* ── 401 리프레시 단일화 ─────────────────────────────────────
   토큰이 만료된 순간 화면에 요청 5개가 떠 있으면 리프레시도 5번 날아갑니다.
   그중 4개는 이미 회전된 리프레시 토큰이라 실패 → 튕김.
   그래서 "진행 중인 리프레시" 프로미스 하나를 모두가 공유합니다.        */
let refreshPromise: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  refreshPromise ??= getAuthBridge()
    .refresh()
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/* ── 응답 인터셉터 ───────────────────────────────────────── */
instance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody | ApiEnvelope<unknown>>) => {
    const cfg = error.config as Cfg | undefined;

    // 1) 네트워크/타임아웃 — 서버까지 못 감
    if (!error.response) {
      throw new ApiError({
        status: 0,
        code: ERROR_CODE.NETWORK,
        message: '네트워크 연결을 확인해 주세요.',
      });
    }

    const { status, data } = error.response;

    // 2) 액세스 토큰 만료 → 1회만 조용히 재발급 후 원요청 재시도
    if (status === 401 && cfg && !cfg._retried && !cfg.skipAuthRefresh) {
      cfg._retried = true;
      const newToken = await refreshOnce();
      if (newToken) return instance.request(cfg);

      getAuthBridge().onSessionExpired();
      throw new ApiError({
        status,
        code: ERROR_CODE.UNAUTHORIZED,
        message: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
      });
    }

    const body = data as ApiErrorBody | undefined;
    throw new ApiError({
      status,
      code: body?.code ?? ERROR_CODE.UNKNOWN,
      message: body?.message ?? '요청을 처리하지 못했습니다.',
      detail: data,
    });
  },
);

/**
 * 얇은 래퍼.
 *
 * 백엔드가 `{ success, data }` 봉투로 감싸서 주므로 여기서 벗겨냅니다.
 * 각 feature 의 api 파일은 `http.get<Concert[]>('/concerts')` 만 쓰면 되고
 * 봉투 구조가 바뀌어도 이 파일 한 곳만 고치면 됩니다.
 */
export const http = {
  get: <T>(url: string, options?: RequestOptions) =>
    instance.get<ApiEnvelope<T>>(url, options).then((r) => r.data.data),

  post: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    instance.post<ApiEnvelope<T>>(url, body, options).then((r) => r.data.data),

  put: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    instance.put<ApiEnvelope<T>>(url, body, options).then((r) => r.data.data),

  patch: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    instance.patch<ApiEnvelope<T>>(url, body, options).then((r) => r.data.data),

  delete: <T>(url: string, options?: RequestOptions) =>
    instance.delete<ApiEnvelope<T>>(url, options).then((r) => r.data.data),

  /** 봉투 없이 원본 응답이 필요할 때 (파일 다운로드, 외부 API 등) */
  raw: instance,
};

/** 멱등키 생성기. 결제/예매 POST 에 사용. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
