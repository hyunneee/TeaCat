import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

/**
 * 아주 작은 목업 라우터.
 *
 * axios 의 "어댑터"(실제로 네트워크를 타는 부분)를 갈아 끼웁니다.
 * 덕분에 화면/훅/api 파일은 목업의 존재를 전혀 모릅니다 — 진짜 서버가 붙어도 코드가 안 바뀝니다.
 *
 * 등록되지 않은 경로는 원래 어댑터로 넘겨서 실제 네트워크로 나갑니다.
 * → 백엔드가 완성되는 순서대로 handlers 에서 한 줄씩 지우면 점진적으로 연동됩니다.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface MockContext {
  /** '/schedules/:scheduleId/seats' 의 :scheduleId 같은 경로 변수 */
  params: Record<string, string>;
  /** 쿼리스트링 */
  query: Record<string, string>;
  /** 요청 본문 (JSON 파싱 완료) */
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

type Handler = (ctx: MockContext) => unknown | Promise<unknown>;

interface Route {
  method: HttpMethod;
  segments: string[];
  handler: Handler;
}

const routes: Route[] = [];

/** 핸들러 등록. handlers/*.ts 에서 호출합니다. */
export function mock(method: HttpMethod, path: string, handler: Handler) {
  routes.push({ method, segments: path.split('/').filter(Boolean), handler });
}

/** 핸들러 안에서 에러 응답을 내고 싶을 때 던집니다. */
export class MockHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'MockHttpError';
    this.status = status;
    this.code = code;
  }
}

export const mockError = (status: number, code: string, message: string) =>
  new MockHttpError(status, code, message);

function matchRoute(method: string, pathname: string) {
  const parts = pathname.split('/').filter(Boolean);

  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.segments.length !== parts.length) continue;

    const params: Record<string, string> = {};
    let ok = true;

    for (let i = 0; i < route.segments.length; i += 1) {
      const seg = route.segments[i] as string;
      const part = parts[i] as string;

      if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(part);
      else if (seg !== part) {
        ok = false;
        break;
      }
    }

    if (ok) return { route, params };
  }
  return null;
}

function parseBody(data: unknown): Record<string, unknown> {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (data instanceof FormData) {
    return Object.fromEntries(data.entries()) as Record<string, unknown>;
  }
  return data as Record<string, unknown>;
}

/** 실제 네트워크처럼 보이게 하는 지연. 로딩 UI 를 확인하려면 값을 올리세요. */
const LATENCY_MS = 220;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createMockAdapter(fallback: AxiosAdapter): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => {
    const pathname = (config.url ?? '').split('?')[0] ?? '';
    const method = (config.method ?? 'get').toUpperCase();
    const matched = matchRoute(method, pathname);

    // 등록 안 된 경로 → 진짜 서버로
    if (!matched) return fallback(config);

    await delay(LATENCY_MS);

    const ctx: MockContext = {
      params: matched.params,
      query: (config.params ?? {}) as Record<string, string>,
      body: parseBody(config.data),
      headers: (config.headers?.toJSON?.() ?? {}) as Record<string, string>,
    };

    const headers = new AxiosHeaders({ 'content-type': 'application/json' });

    try {
      const data = await matched.route.handler(ctx);
      return {
        data: { success: true, data },
        status: 200,
        statusText: 'OK',
        headers,
        config,
      };
    } catch (e) {
      const err = e instanceof MockHttpError ? e : mockError(500, 'UNKNOWN', String(e));

      // 인터셉터가 AxiosError 를 기대하므로 형태를 맞춰 던집니다.
      throw new AxiosError(err.message, String(err.status), config, null, {
        data: { success: false, code: err.code, message: err.message },
        status: err.status,
        statusText: 'Error',
        headers,
        config,
      });
    }
  };
}
