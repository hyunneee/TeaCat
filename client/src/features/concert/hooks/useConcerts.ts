import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { concertApi, concertKeys } from '../api/concertApi';

export function useConcerts(keyword?: string) {
  return useQuery({
    queryKey: concertKeys.list(keyword),
    queryFn: () => concertApi.list(keyword),
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
