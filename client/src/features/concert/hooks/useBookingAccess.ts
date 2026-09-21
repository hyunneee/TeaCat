import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { concertApi, concertKeys } from '../api/concertApi';

/** 예매 진입마다 서버 상태를 확인한다. 헤더용 회차 캐시로 입장을 허용하지 않는다. */
export function useBookingAccess(scheduleId: string, entryKey: string) {
  const validId = /^[1-9]\d*$/.test(scheduleId) && Number.isSafeInteger(Number(scheduleId));
  const query = useQuery({
    queryKey: [...concertKeys.schedule(scheduleId), 'access', entryKey],
    queryFn: ({ signal }) => concertApi.schedule(scheduleId, signal),
    enabled: validId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  const { refetch } = query;

  useEffect(() => {
    // 브라우저의 문서 복원은 React 재마운트 없이 일어날 수 있다.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && validId) void refetch();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [refetch, validId]);

  return { ...query, validId };
}
