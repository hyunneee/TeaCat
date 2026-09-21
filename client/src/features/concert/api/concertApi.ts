import { http } from '@/shared/api';
import type {
  BookingOpenCheck,
  ConcertDetail,
  ConcertLayout,
  ConcertListPage,
  LayoutElement,
  ScheduleDetail,
} from '../model/concert.types';

export const concertApi = {
  /**
   * 공연 목록 (API-201). 검색어는 제목 부분 일치.
   *
   * `past` 는 회차가 전부 지난 공연입니다. 두 목록은 겹치지 않아서
   * 탭으로 갈라 보여줍니다 (`ConcertListPage`).
   */
  list: (keyword?: string, past = false, cursor?: number, size = 20) =>
    http.get<ConcertListPage>('/concerts', { params: { keyword, past, cursor, size } }),

  /** 공연 상세 (API-202) */
  detail: (concertId: string) => http.get<ConcertDetail>(`/concerts/${concertId}`),

  recordView: (concertId: string, viewSession: string) =>
    http.post<{ counted: boolean }>(`/concerts/${concertId}/views`, undefined, {
      headers: { 'X-View-Session': viewSession },
    }),

  /** 회차 단건 (API-203) */
  schedule: (scheduleId: string, signal?: AbortSignal) =>
    http.get<ScheduleDetail>(`/schedules/${scheduleId}`, { signal }),

  /**
   * 예매 오픈 여부 (API-206) — 예매 버튼을 누른 순간 확인합니다.
   *
   * 🔴 캐시하지 마세요. "지금 열렸는가" 를 묻는 것이라 캐시하면 물어본 의미가 없습니다.
   */
  bookingOpen: (scheduleId: string) =>
    http.get<BookingOpenCheck>(`/schedules/${scheduleId}/booking-status`),

  /**
   * 공연이 쓰는 배치도 — 도면 크기와 기둥·출입구 같은 고정 요소.
   *
   * 🔴 좌석맵(`/schedules/{id}/seats`)에 합치지 않는 이유: 좌석맵은 좌석 선택 화면이
   *    **3초마다 폴링**하는데 배치도는 공연 내내 바뀌지 않습니다. 폴링에 얹으면
   *    안 바뀌는 데이터를 3초마다 다시 받게 됩니다.
   */
  layout: async (concertId: string): Promise<ConcertLayout> => {
    const api = await http.get<ApiPerformanceLayout>(`/performances/${concertId}/layout`);
    return {
      concertId: api.performanceId,
      stadiumId: api.stadiumId,
      layoutId: api.stadiumLayoutId,
      layoutName: api.stadiumLayoutName,
      layoutImageUrl: api.layoutImageUrl,
      width: api.layoutWidth,
      height: api.layoutHeight,
      baseElements: (api.baseElements ?? []).map(toLayoutElement),
      elements: (api.elements ?? []).map(toLayoutElement),
    };
  },
};

/* ── 배치도 어댑터 ─────────────────────────────────────────────
   서버는 요소를 `jsonb` 로 저장해서 필드가 보장되지 않습니다. 운영자가 엑셀에서
   가져온 것이라 x/y/width/height 가 비어 있는 행이 섞일 수 있어, 여기서 한 번
   숫자로 못 박습니다 — 화면에서 NaN 좌표를 만나면 SVG 가 통째로 안 그려집니다. */

interface ApiLayoutElement {
  type?: unknown;
  label?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
}

interface ApiPerformanceLayout {
  performanceId: number;
  stadiumId: number;
  stadiumLayoutId: number;
  stadiumLayoutName: string;
  layoutImageUrl: string | null;
  layoutWidth: number;
  layoutHeight: number;
  baseElements: ApiLayoutElement[] | null;
  elements: ApiLayoutElement[] | null;
}

const num = (value: unknown): number =>
  typeof value === 'number' && !Number.isNaN(value) ? value : 0;

const toLayoutElement = (element: ApiLayoutElement): LayoutElement => ({
  type: typeof element.type === 'string' ? element.type : 'ETC',
  label: typeof element.label === 'string' ? element.label : null,
  x: num(element.x),
  y: num(element.y),
  width: num(element.width),
  height: num(element.height),
});

export const concertKeys = {
  all: ['concert'] as const,
  list: (keyword?: string, past = false) =>
    [...concertKeys.all, 'list', keyword ?? '', past] as const,
  detail: (concertId: string) => [...concertKeys.all, 'detail', concertId] as const,
  schedule: (scheduleId: string) => [...concertKeys.all, 'schedule', scheduleId] as const,
  layout: (concertId: string) => [...concertKeys.all, 'layout', concertId] as const,
};
