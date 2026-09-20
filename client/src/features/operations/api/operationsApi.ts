import { http } from '@/shared/api';
import type {
  AttendeeQuery,
  OperationsAttendeeDetail,
  OperationsAttendeePage,
  OperationsSeatMap,
} from '../model/operations.types';

/** 한 회차 운영 조회의 공통 경로. 권한이 이 두 값에 걸려 있습니다 */
const base = (performanceId: number, scheduleId: number) =>
  `/admin/performances/${performanceId}/schedules/${scheduleId}/operations`;

/**
 * 운영 좌석·예매자 API (Model 레이어).
 *
 * 🔴 서버는 **ADMIN 과 담당 공연 기획자**에게만 엽니다. 그리고 역할 검사와 별개로
 *    "그 공연이 내 공연인지" 를 매 요청 검사합니다(`PERFORMANCE_020`). 화면이
 *    담당 공연 목록에서만 고르게 만드는 것은 안내이고, 판단은 서버가 합니다.
 */
export const operationsApi = {
  /** 회차 좌석맵 + 입장 집계. 개인정보는 담기지 않습니다 */
  seatMap: (performanceId: number, scheduleId: number) =>
    http.get<OperationsSeatMap>(`${base(performanceId, scheduleId)}/seats`),

  /** 예매자 명단 한 페이지. 커서는 마지막 줄의 `nextCursor` 를 그대로 보냅니다 */
  attendees: (
    performanceId: number,
    scheduleId: number,
    { keyword, areaId, checkIn }: AttendeeQuery,
    cursor?: string | null,
  ) =>
    http.get<OperationsAttendeePage>(`${base(performanceId, scheduleId)}/attendees`, {
      // 빈 값은 파라미터 자체를 보내지 않습니다 (axios 가 undefined 를 뺍니다)
      params: {
        keyword: keyword.trim() || undefined,
        areaId: areaId ?? undefined,
        checkIn: checkIn === 'ALL' ? undefined : checkIn,
        cursor: cursor ?? undefined,
      },
    }),

  /** 좌석·명단에서 고른 티켓 한 장 */
  attendee: (performanceId: number, scheduleId: number, ticketId: number) =>
    http.get<OperationsAttendeeDetail>(`${base(performanceId, scheduleId)}/attendees/${ticketId}`),
};

/**
 * 쿼리 키.
 *
 * 🔴 회차를 키에 넣습니다. 회차를 바꿨을 때 이전 회차의 응답이 늦게 도착해도 다른 키라
 *    화면을 덮지 않습니다 (계획 문서의 "회차 변경 도중 늦게 도착한 응답").
 */
export const operationsKeys = {
  all: ['operations'] as const,
  seatMap: (performanceId: number, scheduleId: number) =>
    [...operationsKeys.all, 'seats', performanceId, scheduleId] as const,
  attendees: (performanceId: number, scheduleId: number, query: AttendeeQuery) =>
    [...operationsKeys.all, 'attendees', performanceId, scheduleId, query] as const,
  attendee: (performanceId: number, scheduleId: number, ticketId: number) =>
    [...operationsKeys.all, 'attendee', performanceId, scheduleId, ticketId] as const,
};
