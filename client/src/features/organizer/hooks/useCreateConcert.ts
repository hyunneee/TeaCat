import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ROUTES, STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { concertKeys, type ConcertDetail } from '@/features/concert';
import { organizerApi, organizerKeys } from '../api/organizerApi';
import {
  toConcertUpdateRequest,
  type ConcertCreateForm,
  type ConcertUpdateRequest,
} from '../model/organizer.types';

/** 공연장 목록 — 정적 데이터라 오래 캐시합니다 */
export function useStadiums() {
  return useQuery({
    queryKey: organizerKeys.stadiums(),
    queryFn: organizerApi.listStadiums,
    staleTime: STALE_TIME.LONG,
  });
}

/**
 * 공연 등록.
 *
 * 성공하면 공연 목록 캐시를 비우고(방금 등록한 공연이 바로 보이게) 상세로 이동합니다.
 * 등록 화면은 히스토리에서 빼서(replace) 뒤로가기로 빈 폼에 되돌아오지 않게 합니다.
 */
export function useCreateConcert() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (form: ConcertCreateForm) => organizerApi.createConcert(form),
    retry: false,
    onSuccess: ({ concertId }) => {
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });
      toast.success('공연이 등록되었어요.');
      navigate(ROUTES.CONCERT_DETAIL(String(concertId)), { replace: true });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '공연을 등록하지 못했어요.');
    },
  });
}

/**
 * 공연 수정.
 *
 * 이미지는 등록과 달리 서버를 거치지 않습니다 — 업로드 URL 을 받아 스토리지에 직접 올리고(API-270),
 * 돌려받은 key 만 수정 요청에 실어 보냅니다(API-262). 바뀐 필드만 보냅니다.
 *
 * @param beforeNavigate 저장 뒤 상세로 이동하기 **직전**에 부릅니다. 나가기 방지(useUnsavedChangesGuard)를
 *                       풀어주는 용도입니다 — 안 풀면 저장 성공 뒤의 이동을 우리가 막아버립니다.
 */
export function useUpdateConcert(concertId: string, beforeNavigate?: () => void) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ form, original }: { form: ConcertCreateForm; original: ConcertDetail }) => {
      const body: ConcertUpdateRequest = toConcertUpdateRequest(form, original);

      if (form.poster) {
        const upload = await organizerApi.issueUploadUrl('POSTER', form.poster.type);
        body.posterImageKey = await organizerApi.uploadToStorage(upload, form.poster);
      }
      if (form.detailImage) {
        const upload = await organizerApi.issueUploadUrl('DETAIL', form.detailImage.type);
        body.detailImageKey = await organizerApi.uploadToStorage(upload, form.detailImage);
      }

      if (Object.keys(body).length === 0) return false;

      await organizerApi.updateConcert(concertId, body);
      return true;
    },
    retry: false,
    onSuccess: (changed) => {
      if (changed) {
        void queryClient.invalidateQueries({ queryKey: concertKeys.all });
        toast.success('공연 정보를 수정했어요.');
      } else {
        toast.info('바뀐 내용이 없어요.');
      }
      beforeNavigate?.();
      navigate(ROUTES.CONCERT_DETAIL(concertId), { replace: true });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '공연을 수정하지 못했어요.');
    },
  });
}

/**
 * 공연 삭제 — 되돌릴 수 없습니다. 호출부는 반드시 `danger` 확인 모달을 먼저 띄웁니다.
 * 예매 이력이 있으면 서버가 거절하고(PERFORMANCE_017) 그 메시지를 그대로 보여줍니다.
 */
export function useDeleteConcert() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (concertId: string) => organizerApi.deleteConcert(concertId),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });
      toast.success('공연을 삭제했어요.');
      navigate(ROUTES.CONCERTS, { replace: true });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '공연을 삭제하지 못했어요.');
    },
  });
}
