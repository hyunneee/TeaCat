import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { concertKeys, type PerformanceArea } from '@/features/concert';
import { organizerApi, organizerKeys } from '../api/organizerApi';
import {
  buildAreaRows,
  hasEnabledArea,
  validateAreaRows,
  type AreaPricingRow,
  type AreaSaveRequest,
} from '../model/areaPricing';

/**
 * 공연장의 무대 형식 목록 — U형·O형처럼 무대를 바꾼 형식들입니다.
 * 공연에 쓸 수 있는 것은 `ACTIVE` 뿐입니다 (서버도 같은 규칙: PERFORMANCE_LAYOUT_005).
 */
export function useStadiumLayouts(stadiumId: string) {
  const query = useQuery({
    queryKey: organizerKeys.stadiumLayouts(stadiumId),
    queryFn: () => organizerApi.listStadiumLayouts(stadiumId),
    staleTime: STALE_TIME.LONG,
    enabled: !!stadiumId,
  });

  const usable = useMemo(
    () => (query.data ?? []).filter((layout) => layout.status === 'ACTIVE'),
    [query.data],
  );

  return { ...query, usable };
}

/**
 * 무대 형식별 구역 목록 — 형식마다 구역이 다르게 나뉩니다.
 * 배치는 자주 바뀌지 않아 오래 캐시합니다. 형식을 고르기 전에는 부르지 않습니다.
 */
export function useLayoutAreas(layoutId: string) {
  return useQuery({
    queryKey: organizerKeys.layoutAreas(layoutId),
    queryFn: () => organizerApi.listLayoutAreas(layoutId),
    staleTime: STALE_TIME.LONG,
    enabled: !!layoutId,
  });
}

/**
 * 구역별 등급·가격 편집 줄.
 *
 * 무대 형식이 바뀌면 그 형식의 구역으로 줄을 다시 만듭니다 (앞 형식에서 적은 값은 버립니다 —
 * 구역 자체가 다르니 남겨둘 수 없습니다). 이미 저장된 설정(`existing`)이 있으면 그 값으로 채웁니다.
 */
export function useAreaPricingRows(layoutId: string, existing: PerformanceArea[] = []) {
  const { data: stadiumAreas, isPending, isError } = useLayoutAreas(layoutId);
  const [rows, setRows] = useState<AreaPricingRow[]>([]);

  useEffect(() => {
    setRows(stadiumAreas ? buildAreaRows(stadiumAreas, existing) : []);
    // existing 은 공연 상세에서 오는 배열이라 렌더마다 같은 참조입니다. 형식·구역 목록이 바뀔 때만 다시 만듭니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadiumAreas]);

  const errors = useMemo(() => validateAreaRows(rows), [rows]);
  const valid = errors.every((e) => !e);

  const setRow = (index: number, patch: Partial<AreaPricingRow>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return {
    rows,
    setRow,
    errors,
    valid,
    hasAny: hasEnabledArea(rows),
    /* 무대 형식을 아직 안 골랐으면 "로딩" 이 아니라 "대기" 입니다 */
    loading: !!layoutId && isPending,
    error: isError,
  };
}

/**
 * 구역 설정 저장 (API-268). 수정 화면에서 씁니다.
 * 공연 상세(구역 가격 포함)와 내 공연 캐시를 비웁니다.
 */
export function useSaveAreas(concertId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AreaSaveRequest) => organizerApi.saveAreas(concertId, body),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });
      void queryClient.invalidateQueries({ queryKey: organizerKeys.all });
      toast.success('구역 등급·가격을 저장했어요.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '구역 설정을 저장하지 못했어요.');
    },
  });
}
