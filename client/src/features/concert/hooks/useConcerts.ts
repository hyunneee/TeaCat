import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiError } from '@/shared/api';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { getViewSessionId, trackGaEvent } from '@/shared/lib';
import { concertApi, concertKeys } from '../api/concertApi';
import { bookingNotOpenMessage } from '../model/concert.model';

/** @param past 회차가 전부 지난 공연만. 기본은 남은 회차가 있는 공연 */
export function useConcerts(keyword?: string, past = false) {
  return useQuery({
    queryKey: concertKeys.list(keyword, past),
    queryFn: () => concertApi.list(keyword, past),
    staleTime: STALE_TIME.LONG,
    select: (page) => page.concerts,
  });
}

export function useConcertDetail(concertId: string) {
  return useQuery({
    queryKey: concertKeys.detail(concertId),
    queryFn: () => concertApi.detail(concertId),
    staleTime: STALE_TIME.SHORT,
    enabled: !!concertId,
  });
}

export function useRecordConcertView(concertId: string, enabled: boolean) {
  const recordedId = useRef<string | null>(null);
  const record = useMutation({
    mutationFn: (id: string) => concertApi.recordView(id, getViewSessionId()),
  });
  const { mutate } = record;

  useEffect(() => {
    if (!enabled || !/^\d+$/.test(concertId) || recordedId.current === concertId) return;
    recordedId.current = concertId;
    mutate(concertId);
  }, [concertId, enabled, mutate]);

  return record;
}

/**
 * 예매 시작 — **누른 순간** 서버에 "지금 열렸는지" 를 묻고, 열렸을 때만 넘어갑니다.
 *
 * ── 왜 버튼을 잠그지 않고 물어보나 ─────────────────────────
 * 오픈 시각이 지나도 화면은 그대로입니다. 예전에는 오픈 전 회차의 버튼을 아예 안 그려서,
 * 9시 정각이 돼도 **새로고침해야** 버튼이 나타났습니다. 티켓팅에서 그 몇 초가 전부입니다.
 * 그렇다고 몇 초마다 서버에 물으면(폴링) 오픈 직전 트래픽이 회차 수만큼 배로 늘어납니다.
 * 그래서 버튼은 항상 살려두고, **누를 때 한 번만** 확인합니다.
 *
 * ── 변조는 여기서 막지 않습니다 ────────────────────────────
 * 이 확인은 안내용이라 개발자도구로 건너뛸 수 있습니다. 진짜 방어선은 좌석 선점 API 이고
 * (`BookingService.validateTicketingOpen` — 같은 규칙으로 판단합니다), 거기서 막히면
 * `ERR_BOOKING_003` 이 돌아옵니다. 클라이언트 시계를 앞당겨도 판단은 서버가 합니다.
 */
export function useStartBooking() {
  const check = useMutation({
    mutationFn: (scheduleId: string) => concertApi.bookingOpen(scheduleId),
  });

  return {
    /** 지금 확인 중인 회차 ID. 그 버튼만 로딩으로 보여주려고 씁니다 */
    checkingId: check.isPending ? (check.variables ?? null) : null,
    start: (scheduleId: string, onOpen: () => void) =>
      check.mutate(scheduleId, {
        onSuccess: (result) => {
          if (result.status === 'OPEN') {
            /* 퍼널 1단계. **가드를 통과한 것만** 셉니다 — 오픈 전에 누른 것까지 세면
               "예매 시작 대비 완료율" 이 실제보다 낮게 나옵니다 (아래 not_open 으로 따로 셉니다). */
            trackGaEvent('booking_start', { schedule_id: scheduleId });
            onOpen();
            return;
          }
          trackGaEvent('booking_blocked', { schedule_id: scheduleId, fail_reason: result.status });
          toast.info(bookingNotOpenMessage(result));
        },
        onError: (error) =>
          toast.error(
            ApiError.isApiError(error) ? error.message : '예매 가능 여부를 확인하지 못했어요.',
          ),
      }),
  };
}

/** 예매 플로우 화면들의 헤더에 공연명/회차를 띄우기 위한 조회 */
export function useSchedule(scheduleId: string) {
  return useQuery({
    queryKey: concertKeys.schedule(scheduleId),
    queryFn: () => concertApi.schedule(scheduleId),
    staleTime: STALE_TIME.LONG,
    enabled: !!scheduleId,
  });
}

/**
 * 공연 배치도 — 도면 크기와 기둥·출입구 같은 고정 요소.
 *
 * 공연 내내 바뀌지 않아 오래 캐시합니다. 구역 도면(VenueMap)이 씁니다.
 */
export function useConcertLayout(concertId: string | undefined) {
  return useQuery({
    queryKey: concertKeys.layout(concertId ?? ''),
    queryFn: () => concertApi.layout(concertId ?? ''),
    staleTime: STALE_TIME.LONG,
    enabled: !!concertId,
  });
}
