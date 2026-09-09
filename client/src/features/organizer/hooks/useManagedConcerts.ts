import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { useAuth } from '@/features/auth';
import { concertKeys } from '@/features/concert';
import { organizerApi, organizerKeys } from '../api/organizerApi';
import { toAreaSettings, type ConcertAreaRow } from '../model/organizer.types';

/**
 * 어드민 콘솔의 공연 관리 목록 (Controller 레이어).
 *
 * 🔴 역할에 따라 **다른 API 를 부릅니다.**
 * - ADMIN → `GET /admin/concerts` (등록자 무관, 전체)
 * - PERFORMANCE → `GET /admin/concerts/mine` (본인이 등록한 것만)
 *
 * 서버가 전체 목록을 ADMIN 으로 막아 두었기 때문입니다. 여기서 판단을 한 번에 해 두면
 * 화면은 "관리할 수 있는 공연 목록" 하나만 알면 됩니다.
 *
 * 검색은 ADMIN 목록에서만 서버로 나갑니다 — 내 공연 목록은 짧아 서버 검색이 없습니다.
 * (그래서 PERFORMANCE 에게는 검색창을 보여주지 않습니다. `searchable` 로 알려줍니다)
 */
export function useManagedConcerts() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [keyword, setKeyword] = useState('');

  const all = useQuery({
    queryKey: organizerKeys.allConcerts(keyword.trim()),
    queryFn: () => organizerApi.allConcerts(keyword),
    staleTime: STALE_TIME.SHORT,
    enabled: isAdmin,
    // 검색어를 칠 때마다 표가 비워지지 않게 이전 결과를 붙들어 둡니다
    placeholderData: keepPreviousData,
  });

  const mine = useQuery({
    queryKey: organizerKeys.myConcerts(),
    queryFn: organizerApi.myConcerts,
    staleTime: STALE_TIME.SHORT,
    enabled: !isAdmin,
  });

  const result = isAdmin ? all : mine;

  return { ...result, keyword, setKeyword, searchable: isAdmin };
}

/** 구역 등급·가격 — 아직 팔지 않는 구역까지 옵니다 */
export function useConcertAreas(concertId: string) {
  return useQuery({
    queryKey: organizerKeys.concertAreas(concertId),
    queryFn: () => organizerApi.concertAreas(concertId),
    staleTime: STALE_TIME.SHORT,
    enabled: !!concertId,
  });
}

/**
 * 구역 등급·가격 저장.
 *
 * 🔴 좌석을 이미 만든 회차가 있으면 이 저장만으로는 좌석이 따라 바뀌지 않습니다.
 *    구역을 새로 열었다면 회차 좌석 생성을 다시 돌려야 합니다 — 화면에서 안내합니다.
 */
export function useSaveConcertAreas(concertId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rows: ConcertAreaRow[]) =>
      organizerApi.saveConcertAreas(concertId, toAreaSettings(rows)),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizerKeys.concertAreas(concertId) });
      // 관람객 화면의 구역 가격도 이 값을 읽습니다
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });
      toast.success('구역 설정을 저장했어요.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '구역 설정을 저장하지 못했어요.');
    },
  });
}
