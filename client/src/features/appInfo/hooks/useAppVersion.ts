import { useQuery } from '@tanstack/react-query';
import { env } from '@/shared/config';
import { STALE_TIME } from '@/shared/constants';
import { appInfoApi, appInfoKeys } from '../api/appInfoApi';
import { updateStateOf } from '../model/appInfo.model';

/**
 * 지금 이 앱이 최신인지.
 *
 * 서버 조회가 실패해도 **현재 버전은 항상 보여줍니다.** 네트워크가 안 될 때
 * 앱 정보 화면이 비어 있으면 문의가 늘어납니다.
 */
export function useAppVersion() {
  const query = useQuery({
    queryKey: appInfoKeys.version(),
    queryFn: () => appInfoApi.version(),
    staleTime: STALE_TIME.LONG,
    // 버전 확인이 실패해도 앱은 계속 써야 하므로 조용히 넘어갑니다.
    retry: 1,
  });

  return {
    current: env.appVersion,
    latest: query.data?.latest,
    releasedAt: query.data?.releasedAt,
    notes: query.data?.notes,
    state: updateStateOf(env.appVersion, query.data),
    isChecking: query.isFetching,
    /** 사용자가 "업데이트 확인" 을 눌렀을 때 */
    recheck: () => void query.refetch(),
  };
}
