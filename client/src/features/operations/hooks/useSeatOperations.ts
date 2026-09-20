import { useEffect, useState } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { operationsApi, operationsKeys } from '../api/operationsApi';
import { mappableAreas, standingAreas } from '../model/operations.model';
import type { AttendeeQuery, OperationsCheckInFilter } from '../model/operations.types';

/**
 * 좌석 현황 폴링 주기.
 *
 * 예매 화면(3초)보다 느립니다. 운영자가 보는 값은 "지금 몇 명 들어왔나" 라서 초 단위로
 * 맞을 필요가 없고, 이 응답은 캐시를 공유하지 않아 사람 수만큼 쿼리가 나갑니다.
 * 탭이 백그라운드면 TanStack Query 가 기본값으로 멈춥니다.
 */
const SEAT_POLL_MS = 15_000;

const EMPTY_QUERY: AttendeeQuery = { keyword: '', areaId: null, checkIn: 'ALL' };

/**
 * 운영 콘솔 "좌석·예매자" 의 Controller.
 *
 * 공연·회차 선택은 **화면 상태**(페이지의 `useState`)이고, 좌석·명단은 서버 데이터라
 * TanStack Query 가 주인입니다 (CLAUDE.md 3-4).
 *
 * 🔴 **회차가 바뀌면 선택과 명단 필터를 비웁니다.** 안 비우면 이전 회차에서 고른 좌석의
 *    티켓 번호로 새 회차에 상세를 물어 404 가 나고, "회차를 바꿨는데 화면이 고장났다" 로
 *    읽힙니다. 늦게 도착한 이전 회차의 응답은 쿼리 키가 달라 화면을 덮지 못합니다
 *    (`operationsKeys` 주석).
 */
export function useSeatOperations(performanceId: number | null, scheduleId: number | null) {
  const [query, setQuery] = useState<AttendeeQuery>(EMPTY_QUERY);
  /** 좌석맵과 명단이 **같은 선택 키**를 씁니다 — 어느 쪽을 눌러도 오른쪽 패널이 같습니다 */
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  useEffect(() => {
    setQuery(EMPTY_QUERY);
    setSelectedTicketId(null);
  }, [performanceId, scheduleId]);

  const enabled = performanceId !== null && scheduleId !== null;

  const seatMap = useQuery({
    queryKey: operationsKeys.seatMap(performanceId ?? 0, scheduleId ?? 0),
    queryFn: () => operationsApi.seatMap(performanceId as number, scheduleId as number),
    enabled,
    staleTime: STALE_TIME.REALTIME,
    refetchInterval: enabled ? SEAT_POLL_MS : false,
    refetchIntervalInBackground: false,
  });

  /* 명단은 커서 페이지입니다. `keepPreviousData` 로 다음 페이지를 받는 동안 표가
     비워지지 않게 합니다 — 관리 화면에서 표가 깜빡이면 어디를 보고 있었는지 놓칩니다. */
  const attendees = useInfiniteQuery({
    queryKey: operationsKeys.attendees(performanceId ?? 0, scheduleId ?? 0, query),
    queryFn: ({ pageParam }) =>
      operationsApi.attendees(performanceId as number, scheduleId as number, query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
    staleTime: STALE_TIME.SHORT,
    placeholderData: keepPreviousData,
  });

  const detail = useQuery({
    queryKey: operationsKeys.attendee(performanceId ?? 0, scheduleId ?? 0, selectedTicketId ?? 0),
    queryFn: () =>
      operationsApi.attendee(
        performanceId as number,
        scheduleId as number,
        selectedTicketId as number,
      ),
    enabled: enabled && selectedTicketId !== null,
    staleTime: STALE_TIME.SHORT,
  });

  /* 검색어·구역·입장 상태를 바꾸면 **첫 페이지부터** 다시 받습니다. 쿼리 키에 조건이
     들어 있어서 키가 바뀌는 것으로 자동으로 그렇게 됩니다 — 커서를 손으로 되돌리지 마세요. */
  const areas = seatMap.data?.areas ?? [];
  const seated = mappableAreas(areas);

  const search = (keyword: string) => setQuery((prev) => ({ ...prev, keyword }));
  const filterArea = (areaId: number | null) => setQuery((prev) => ({ ...prev, areaId }));
  const filterCheckIn = (checkIn: OperationsCheckInFilter) =>
    setQuery((prev) => ({ ...prev, checkIn }));

  return {
    query,
    search,
    filterArea,
    filterCheckIn,

    selectedTicketId,
    /** 좌석·명단 어느 쪽에서 눌러도 이걸 부릅니다. 같은 줄을 다시 누르면 선택을 풉니다 */
    select: (ticketId: number | null) =>
      setSelectedTicketId((prev) => (prev === ticketId ? null : ticketId)),

    seatMap,
    /** 명단 필터가 쓰는 전체 구역 (스탠딩 포함) */
    areas,
    /** 스탠딩 구역 — 정원 카드로 따로 보여줍니다 */
    standingAreas: standingAreas(areas),
    /** 도면에 그릴 구역. 구역 필터가 걸려 있으면 그 구역만이라 뷰박스가 확대됩니다 */
    drawnAreas: query.areaId === null ? seated : seated.filter((a) => a.areaId === query.areaId),
    /** 좌석제 구역이 하나도 없는가 — 스탠딩만 있는 회차와 좌석 미생성을 구분해 안내합니다 */
    hasSeatedAreas: seated.length > 0,

    attendees,
    /** 지금까지 받은 페이지를 한 배열로 */
    attendeeRows: attendees.data?.pages.flatMap((page) => page.items) ?? [],
    totalCount: attendees.data?.pages[0]?.totalCount ?? 0,
    detail,
  };
}
