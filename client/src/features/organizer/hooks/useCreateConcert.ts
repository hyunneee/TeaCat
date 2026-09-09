import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ROUTES, STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { concertKeys, type ConcertDetail } from '@/features/concert';
import { organizerApi, organizerKeys } from '../api/organizerApi';
import {
  filledPhotocardDesigns,
  toConcertUpdateRequest,
  type ConcertCreateForm,
  type ConcertUpdateRequest,
  type PhotocardDesignForm,
} from '../model/organizer.types';

/**
 * 성공 뒤 어디로 보낼지.
 *
 * 공연 관리 입구가 둘입니다 — 앱 화면(`/concerts/...`)과 어드민 콘솔(`/admin/concerts/...`).
 * 훅이 한쪽 경로를 박아두면 다른 쪽에서 저장한 뒤 화면이 통째로 튑니다.
 * 넘기지 않으면 앱 화면으로 갑니다(기존 동작).
 */
export interface ConcertRedirect {
  /** 등록·수정 성공 뒤 갈 곳 */
  detail?: (concertId: string) => string;
  /** 삭제 성공 뒤 갈 곳 */
  list?: string;
}

const afterWrite = (redirect: ConcertRedirect | undefined, concertId: string) =>
  redirect?.detail?.(concertId) ?? ROUTES.CONCERT_DETAIL(concertId);

/** 공연장 목록 — 정적 데이터라 오래 캐시합니다 */
export function useStadiums() {
  return useQuery({
    queryKey: organizerKeys.stadiums(),
    queryFn: organizerApi.listStadiums,
    staleTime: STALE_TIME.LONG,
  });
}

/**
 * 공연 등록 — 포토카드 도안까지 함께.
 *
 * 성공하면 공연 목록 캐시를 비우고(방금 등록한 공연이 바로 보이게) 상세로 이동합니다.
 * 등록 화면은 히스토리에서 빼서(replace) 뒤로가기로 빈 폼에 되돌아오지 않게 합니다.
 *
 * ── 도안은 공연 뒤에 따로 보냅니다 ─────────────────────────────
 *
 * 도안 API 가 `performanceId` 를 필수로 받아 <b>공연이 만들어진 뒤에야</b> 보낼 수 있습니다.
 * 한 번에 묶는 API 가 없으므로 순서가 있습니다.
 *
 * ```
 * ① POST /admin/concerts            → concertId
 * ② POST /admin/photocard-designs   도안마다 한 번씩 (IPFS 핀 2회 + 온체인 등록)
 * ```
 *
 * <b>②가 실패해도 ①을 되돌리지 않습니다.</b> 공연은 이미 만들어졌고, 여기서 지우면
 * 사용자가 폼을 통째로 다시 채워야 합니다. 실패한 도안 수만 알려주고 공연 상세로 보냅니다.
 *
 * 순차로 보내는 이유는 도안 하나가 Pinata 를 두 번 부르고 체인 트랜잭션까지 보내기 때문입니다 —
 * 한꺼번에 던지면 실패했을 때 <b>어디까지 올라갔는지</b> 알기 어려워집니다.
 */
export function useCreateConcert(redirect?: ConcertRedirect) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  /** 도안 몇 개째 올리는 중인지. 버튼 옆 진행 표시에 씁니다 */
  const [designProgress, setDesignProgress] = useState<DesignProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ form, designs = [] }: CreateConcertInput) => {
      const { concertId } = await organizerApi.createConcert(form);

      const targets = filledPhotocardDesigns(designs);
      let failed = 0;

      for (const [index, design] of targets.entries()) {
        setDesignProgress({ done: index, total: targets.length });
        try {
          await organizerApi.createPhotocardDesign(concertId, design);
        } catch {
          // 한 장이 실패해도 나머지는 계속 올린다. 어차피 개별 요청이라 서로 영향이 없다
          failed += 1;
        }
      }

      setDesignProgress(null);
      return { concertId, designTotal: targets.length, designFailed: failed };
    },
    retry: false,
    onSuccess: ({ concertId, designTotal, designFailed }) => {
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });

      if (designFailed > 0) {
        toast.error(`공연은 등록됐지만 포토카드 도안 ${designFailed}장을 올리지 못했어요.`);
      } else if (designTotal > 0) {
        // 등록 요청까지만 끝난 상태다. 체인 확정은 서버 감시가 30~40초 뒤에 채운다
        toast.success(`공연과 포토카드 도안 ${designTotal}장을 등록했어요.`);
      } else {
        toast.success('공연이 등록되었어요.');
      }

      navigate(afterWrite(redirect, String(concertId)), { replace: true });
    },
    onError: (error) => {
      setDesignProgress(null);
      toast.error(error instanceof Error ? error.message : '공연을 등록하지 못했어요.');
    },
  });

  return { ...mutation, designProgress };
}

export interface CreateConcertInput {
  form: ConcertCreateForm;
  designs?: PhotocardDesignForm[];
}

export interface DesignProgress {
  /** 지금까지 보낸 수 */
  done: number;
  total: number;
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
export function useUpdateConcert(
  concertId: string,
  beforeNavigate?: () => void,
  redirect?: ConcertRedirect,
) {
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
      navigate(afterWrite(redirect, concertId), { replace: true });
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
export function useDeleteConcert(redirect?: ConcertRedirect) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (concertId: string) => organizerApi.deleteConcert(concertId),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });
      toast.success('공연을 삭제했어요.');
      navigate(redirect?.list ?? ROUTES.CONCERTS, { replace: true });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '공연을 삭제하지 못했어요.');
    },
  });
}
