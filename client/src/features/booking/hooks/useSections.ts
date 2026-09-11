import { useSeatMap } from './useSeatMap';

/**
 * 구역 목록 (플로우: 봇 확인 → **구역** → 좌석 선택).
 *
 * 좌석 현황 응답에서 구역만 꺼내 씁니다. 구역 전용 API 를 따로 부르지 않는
 * 이유는 잔여 좌석 수가 두 화면에서 어긋나지 않게 하려는 것입니다 —
 * 같은 쿼리를 공유하므로 구역 화면에서 본 잔여 수가 좌석 화면과 항상 같습니다.
 */
export function useSections(scheduleId: string) {
  const query = useSeatMap(scheduleId);

  return {
    ...query,
    data: query.data?.sections,
  };
}
