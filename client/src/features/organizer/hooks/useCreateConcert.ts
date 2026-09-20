import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ROUTES, STALE_TIME } from '@/shared/constants';
import { toast } from '@/shared/stores';
import { concertKeys, type ConcertDetail } from '@/features/concert';
import { organizerApi, organizerKeys } from '../api/organizerApi';
import { toAreaSaveRequest, type AreaPricingRow } from '../model/areaPricing';
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
 * 공연 관리 입구는 어드민 콘솔(`/admin/concerts/...`) 하나입니다.
 * 넘기지 않으면 그쪽으로 갑니다. (예전에는 앱 화면에도 등록·수정이 한 벌 더 있어서
 * 훅이 한쪽 경로를 박아두면 다른 쪽에서 저장한 뒤 화면이 튀었고, 그래서 생긴 구멍입니다.
 * 지금은 화면이 하나뿐이라 굳이 넘기지 않아도 됩니다.)
 */
export interface ConcertRedirect {
  /** 등록·수정 성공 뒤 갈 곳 */
  detail?: (concertId: string) => string;
  /** 등록은 됐는데 구역 가격 저장이 실패했을 때 갈 곳 (거기서 다시 저장해야 합니다) */
  edit?: (concertId: string) => string;
  /** 삭제 성공 뒤 갈 곳 */
  list?: string;
}

const afterWrite = (redirect: ConcertRedirect | undefined, concertId: string) =>
  redirect?.detail?.(concertId) ?? ROUTES.ADMIN_CONCERT_EDIT(concertId);

const afterPartialWrite = (redirect: ConcertRedirect | undefined, concertId: string) =>
  redirect?.edit?.(concertId) ?? ROUTES.ADMIN_CONCERT_EDIT(concertId);

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
 * 공연(회차 포함)을 만든 뒤, 구역 등급·가격을 정했다면 이어서 저장합니다(API-268).
 * 두 요청이라 구역 저장만 실패할 수 있는데, 그때는 공연은 이미 있으므로 수정 화면으로 보내
 * 구역 설정을 다시 저장하게 합니다 — 등록 자체를 되돌리면 방금 올린 이미지·회차까지 다시 해야 합니다.
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
    mutationFn: async ({ form, areaRows = [], designs = [] }: CreateConcertInput) => {
      const { concertId } = await organizerApi.createConcert(form);

      /* 구역 가격을 먼저 저장합니다. 요청 하나로 끝나고, 이게 있어야 팔 수 있는 공연이 됩니다.
         도안은 IPFS·체인까지 가서 훨씬 느리므로 뒤로 미룹니다 */
      let areaError: unknown = null;
      const areas = toAreaSaveRequest(areaRows);
      if (areas) {
        try {
          await organizerApi.saveAreas(String(concertId), areas);
        } catch (error) {
          areaError = error;
        }
      }

      const targets = filledPhotocardDesigns(designs);
      let failed = 0;
      let designError: string | null = null;

      for (const [index, design] of targets.entries()) {
        setDesignProgress({ done: index, total: targets.length });
        try {
          await organizerApi.createPhotocardDesign(concertId, design);
        } catch (error) {
          // 한 장이 실패해도 나머지는 계속 올린다. 어차피 개별 요청이라 서로 영향이 없다
          failed += 1;
          designError ??= error instanceof Error ? error.message : '등록 요청을 처리하지 못했어요.';
        }
      }

      setDesignProgress(null);
      return {
        concertId,
        areaError,
        designTotal: targets.length,
        designFailed: failed,
        designError,
      };
    },
    retry: false,
    onSuccess: ({ concertId, areaError, designTotal, designFailed, designError }) => {
      void queryClient.invalidateQueries({ queryKey: concertKeys.all });
      const id = String(concertId);

      /* 구역 저장 실패가 더 급합니다 — 가격이 없으면 팔 수 없는 공연이라 수정 화면으로 보냅니다.
         도안 실패는 공연을 파는 데 지장이 없어 알림만 남깁니다 */
      if (areaError) {
        toast.error(
          areaError instanceof Error
            ? `공연은 등록됐지만 구역 가격 저장에 실패했어요: ${areaError.message}`
            : '공연은 등록됐지만 구역 가격 저장에 실패했어요. 수정 화면에서 다시 저장해 주세요.',
        );
        navigate(afterPartialWrite(redirect, id), { replace: true });
        return;
      }

      if (designFailed > 0) {
        toast.error(
          `공연은 등록됐지만 포토카드 도안 ${designFailed}장을 올리지 못했어요. ${designError ?? ''}`,
        );
      } else if (designTotal > 0) {
        // 등록 요청까지만 끝난 상태다. 체인 확정은 서버 감시가 30~40초 뒤에 채운다
        toast.success(`공연과 포토카드 도안 ${designTotal}장을 등록했어요.`);
      } else {
        toast.success('공연이 등록되었어요.');
      }

      navigate(afterWrite(redirect, id), { replace: true });
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
  /** 구역별 등급·가격 줄. 켠 구역이 없으면 저장을 건너뜁니다 */
  areaRows?: AreaPricingRow[];
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
    mutationFn: async ({
      form,
      original,
    }: {
      form: ConcertCreateForm;
      original: ConcertDetail;
    }) => {
      const body: ConcertUpdateRequest = toConcertUpdateRequest(form, original);

      /* uploadImage 가 줄이기 → URL 발급 → PUT 을 한 번에 합니다 (organizerApi 주석) */
      if (form.poster) {
        body.posterImageKey = await organizerApi.uploadImage('POSTER', form.poster);
      }
      if (form.detailImage) {
        body.detailImageKey = await organizerApi.uploadImage('DETAIL', form.detailImage);
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
      navigate(redirect?.list ?? ROUTES.ADMIN_CONCERTS, { replace: true });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '공연을 삭제하지 못했어요.');
    },
  });
}
